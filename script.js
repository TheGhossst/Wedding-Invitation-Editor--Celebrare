let currentZoom = 100;
let currentPage = 0;
let pages = [];
let undoStack = [];
let redoStack = [];
let activeTextBox = null;
let isDragging = false;
let initialMousePos = { x: 0, y: 0 };
let initialTextBoxPos = { x: 0, y: 0 };

document.addEventListener('DOMContentLoaded', function() {
    initializeEditor();
    setupEventListeners();
    //createDefaultTextBoxes();
    setupMoreOptionsListeners();
    
    const firstPage = document.getElementById('weddingCard').cloneNode(true);
    pages.push(firstPage);
    
    updatePageNavigation();
    updatePageThumbnails();

    loadFromLocalStorage();
});

function initializeEditor() {
    const weddingCard = document.getElementById('weddingCard');
    weddingCard.style.backgroundImage = "url('My Invitation.jpeg')";
    
    document.getElementById('zoomRange').value = currentZoom;
    updateZoomDisplay();
}

function generateUniqueId() {
    return 'textbox_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

/*function createDefaultTextBoxes() {
    const defaultTexts = {
        title: 'Wedding Invitation',
        date: 'Date: DD/MM/YYYY',
        venue: 'Venue: Your Venue Here'
    };

    for (const [id, text] of Object.entries(defaultTexts)) {
        const textBox = createTextBox(text);
        textBox.id = id;
        textBox.dataset.persistentId = id;
        textBox.style.top = `${30 + Object.keys(defaultTexts).indexOf(id) * 20}%`;
        textBox.style.left = '50%';
        textBox.style.transform = 'translate(-50%, -50%)';
        document.getElementById('weddingCard').appendChild(textBox);
    }
}*/

function setupEventListeners() {
    document.querySelector('.edit-title-btn').addEventListener('click', showEditTitleModal);

    setupModalListeners();
    setupStyleControls();
    setupZoomControls();
    
    document.getElementById('addTextBox').addEventListener('click', addTextBox);

    const undoBtn = document.querySelector('.undo-btn');
    const redoBtn = document.querySelector('.redo-btn');
    
    if (undoBtn) {
        undoBtn.addEventListener('click', undo);
    }
    
    if (redoBtn) {
        redoBtn.addEventListener('click', redo);
    }

    document.querySelector('.add-page').addEventListener('click', addNewPage);
    document.querySelector('.add-page-card').addEventListener('click', addNewPage);

    document.querySelector('.nav-prev').addEventListener('click', () => changePage(-1));
    document.querySelector('.nav-next').addEventListener('click', () => changePage(1));

    document.getElementById('saveButton').addEventListener('click', saveToLocalStorage);
    document.getElementById('downloadButton').addEventListener('click', generatePDF);

    const dynamicTextarea = document.getElementById('dynamicTextarea');
    dynamicTextarea.addEventListener('input', updateActiveTextBox);
}

function setupModalListeners() {
    const editTitleModal = document.getElementById('editTitleModal');

    editTitleModal.querySelector('.save-btn').addEventListener('click', () => {
        const newTitle = document.getElementById('newTitleInput').value;
        document.getElementById('cardTitle').textContent = newTitle;
        editTitleModal.classList.remove('active');
    });
    
    editTitleModal.querySelector('.cancel-btn').addEventListener('click', () => {
        editTitleModal.classList.remove('active');
    });

    const moreOptionsModal = document.getElementById('moreOptionsModal');
    document.querySelector('.more-options-btn').addEventListener('click', () => {
        moreOptionsModal.classList.add('active');
    });
    
    moreOptionsModal.querySelector('.close-modal').addEventListener('click', () => {
        moreOptionsModal.classList.remove('active');
    });

    const customizePagesModal = document.getElementById('customizePagesModal');
    document.querySelector('.customize-pages-btn').addEventListener('click', () => {
        customizePagesModal.classList.add('active');
    });
    
    customizePagesModal.querySelector('.close-modal').addEventListener('click', () => {
        customizePagesModal.classList.remove('active');
    });
}

function setupStyleControls() {
    document.getElementById('color').addEventListener('input', function() {
        if (activeTextBox) {
            activeTextBox.style.color = this.value;
            addToUndoStack('style', activeTextBox);
            updateDynamicTextarea();
        }
    });

    document.getElementById('font').addEventListener('change', function() {
        if (activeTextBox) {
            activeTextBox.style.fontFamily = this.value;
            addToUndoStack('style', activeTextBox);
            updateDynamicTextarea();
        }
    });

    document.getElementById('size').addEventListener('change', function() {
        if (activeTextBox) {
            activeTextBox.style.fontSize = this.value + 'px';
            addToUndoStack('style', activeTextBox);
            updateDynamicTextarea();
        }
    });

    document.querySelectorAll('.size-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const input = document.getElementById('size');
            const currentSize = parseInt(input.value);
            const action = this.dataset.action;
            
            if (action === 'increase') {
                input.value = Math.min(72, currentSize + 2);
            } else {
                input.value = Math.max(12, currentSize - 2);
            }
            
            input.dispatchEvent(new Event('change'));
        });
    });
}

function setupZoomControls() {
    document.getElementById('zoomRange').addEventListener('input', handleZoom);
    document.querySelector('.zoom-in').addEventListener('click', () => adjustZoom(10));
    document.querySelector('.zoom-out').addEventListener('click', () => adjustZoom(-10));
}

function showEditTitleModal() {
    const modal = document.getElementById('editTitleModal');
    const input = document.getElementById('newTitleInput');
    input.value = document.getElementById('cardTitle').textContent;
    modal.classList.add('active');
    input.focus();
}

function createTextBox(defaultText = 'Your Text Here') {
    const textBox = document.createElement('textarea');
    textBox.type = 'text';
    textBox.className = 'textBox';
    textBox.value = defaultText;
    textBox.dataset.persistentId = generateUniqueId();
    
    setupDraggable(textBox);
    setupTextBoxListeners(textBox);
    
    return textBox;
}

function setupTextBoxListeners(textBox) {
    textBox.addEventListener('focus', function() {
        setActiveTextBox(this);
    });

    textBox.addEventListener('input', function() {
        addToUndoStack('edit', this);
        updateDynamicTextarea();
    });

    textBox.addEventListener('keydown', function(event) {
        if (event.key === 'Delete' && this === activeTextBox) {
            addToUndoStack('delete', this);
            this.remove();
            activeTextBox = null;
            updateDynamicTextarea();
        }
    });
}

function addTextBox() {
    const textBox = createTextBox();
    textBox.style.left = '50%';
    textBox.style.top = '50%';
    textBox.style.transform = 'translate(-50%, -50%)';
    document.getElementById('weddingCard').appendChild(textBox);
    addToUndoStack('add', textBox);
    setActiveTextBox(textBox);
}

function setupDraggable(element) {
    element.addEventListener('mousedown', function(e) {
        if (e.target === element) {
            isDragging = true;
            activeTextBox = element;
            initialMousePos.x = e.clientX;
            initialMousePos.y = e.clientY;
            initialTextBoxPos.x = element.offsetLeft;
            initialTextBoxPos.y = element.offsetTop;
            
            addToUndoStack('move', element);
        }
    });
}

document.addEventListener('mousemove', function(e) {
    if (isDragging && activeTextBox) {
        const dx = e.clientX - initialMousePos.x;
        const dy = e.clientY - initialMousePos.y;
        
        activeTextBox.style.left = (initialTextBoxPos.x + dx) + 'px';
        activeTextBox.style.top = (initialTextBoxPos.y + dy) + 'px';
    }
});

document.addEventListener('mouseup', function() {
    isDragging = false;
});

function setActiveTextBox(textBox) {
    if (activeTextBox) {
        activeTextBox.classList.remove('active');
    }
    activeTextBox = textBox;
    activeTextBox.classList.add('active');

    document.getElementById('color').value = rgb2hex(textBox.style.color || '#000000');
    document.getElementById('font').value = textBox.style.fontFamily || 'Arial';
    document.getElementById('size').value = parseInt(textBox.style.fontSize) || 24;

    updateDynamicTextarea();
}

function updateDynamicTextarea() {
    const dynamicTextarea = document.getElementById('dynamicTextarea');
    if (activeTextBox) {
        dynamicTextarea.value = activeTextBox.value;
        dynamicTextarea.style.fontFamily = activeTextBox.style.fontFamily;
        dynamicTextarea.style.fontSize = activeTextBox.style.fontSize;
        dynamicTextarea.style.color = activeTextBox.style.color;
    } else {
        dynamicTextarea.value = '';
    }
}

function updateActiveTextBox() {
    if (activeTextBox) {
        activeTextBox.value = document.getElementById('dynamicTextarea').value;
        addToUndoStack('edit', activeTextBox);
    }
}

function handleZoom(e) {
    currentZoom = parseInt(e.target.value);
    updateZoomDisplay();
    applyZoom();
}

function adjustZoom(delta) {
    currentZoom = Math.max(50, Math.min(150, currentZoom + delta));
    document.getElementById('zoomRange').value = currentZoom;
    updateZoomDisplay();
    applyZoom();
}

function updateZoomDisplay() {
    document.querySelector('.zoom-value').textContent = `${currentZoom}%`;
}

function applyZoom() {
    const card = document.getElementById('weddingCard');
    card.style.transform = `scale(${currentZoom / 100})`;
}

function changePage(delta) {
    if (pages.length === 0) return;

    currentPage = Math.max(0, Math.min(pages.length - 1, currentPage + delta));
    renderCurrentPage();
    updatePageNavigation();
}

function addToUndoStack(action, element) {
    undoStack.push({
        action,
        persistentId: element.dataset.persistentId,
        value: element.value,
        style: element.style.cssText,
        position: {
            left: element.style.left,
            top: element.style.top
        }
    });
    
    redoStack = [];
    updateUndoRedoButtons();
}

function undo() {
    const lastAction = undoStack.pop();
    if (lastAction) {
        const element = document.querySelector(`[data-persistent-id="${lastAction.persistentId}"]`);

        if (element) {
            redoStack.push({
                action: lastAction.action,
                persistentId: lastAction.persistentId,
                value: element.value,
                style: element.style.cssText,
                position: {
                    left: element.style.left,
                    top: element.style.top
                }
            });

            switch(lastAction.action) {
                case 'add':
                    element.remove();
                    break;
                case 'delete':
                    document.getElementById('weddingCard').appendChild(element);
                    break;
                case 'edit':
                case 'style':
                case 'move':
                    element.value = lastAction.value;
                    element.style.cssText = lastAction.style;
                    break;
            }
            
            updateUndoRedoButtons();
            updateDynamicTextarea();
        }
    }
}

function redo() {
    const lastAction = redoStack.pop();
    if (lastAction) {
        const element = document.querySelector(`[data-persistent-id="${lastAction.persistentId}"]`);

        if (element) {
            undoStack.push({
                action: lastAction.action,
                persistentId: lastAction.persistentId,
                value: element.value,
                style: element.style.cssText,
                position: {
                    left: element.style.left,
                    top: element.style.top
                }
            });

            switch(lastAction.action) {
                case 'add':
                    document.getElementById('weddingCard').appendChild(element);
                    break;
                case 'delete':
                    element.remove();
                    break;
                case 'edit':
                case 'style':
                case 'move':
                    element.value = lastAction.value;
                    element.style.cssText = lastAction.style;
                    break;
            }
            
            updateUndoRedoButtons();
            updateDynamicTextarea();
        }
    }
}

function updateUndoRedoButtons() {
    document.querySelector('.undo-btn').disabled = undoStack.length === 0;
    document.querySelector('.redo-btn').disabled = redoStack.length === 0;
}

function rgb2hex(rgb) {
    if (!rgb) return '#000000';
    if (rgb.startsWith('#')) return rgb;
    
    const rgb_match = rgb.match(/^rgb$$(\d+),\s*(\d+),\s*(\d+)$$$/);
    if (!rgb_match) return '#000000';
    
    const hex = x => ('0' + parseInt(x).toString(16)).slice(-2);
    return '#' + hex(rgb_match[1]) + hex(rgb_match[2]) + hex(rgb_match[3]);
}

function addNewPage() {
    const newPageContainer = document.createElement('div');
    newPageContainer.className = 'page-container';
    newPageContainer.style.backgroundImage = "url('My Invitation.jpeg')";
    
    pages.push(newPageContainer);
    
    currentPage = pages.length - 1;
    
    updatePageNavigation();
    renderCurrentPage();
    updatePageThumbnails();
}

function updatePageThumbnails() {
    const pageListContainer = document.querySelector('.page-thumbnails');
    const customizePagesGrid = document.querySelector('.pages-grid');
    
    const existingThumbnails = pageListContainer.querySelectorAll('.page-thumbnail:not(:last-child)');
    existingThumbnails.forEach(thumbnail => thumbnail.remove());
    
    const existingCards = customizePagesGrid.querySelectorAll('.page-card');
    existingCards.forEach(card => card.remove());

    pages.forEach((page, index) => {
        const thumbnailContainer = document.createElement('div');
        thumbnailContainer.className = 'page-thumbnail';
        if (index === currentPage) thumbnailContainer.classList.add('selected');
        thumbnailContainer.dataset.pageIndex = index;
        
        const thumbnailImage = document.createElement('img');
        thumbnailImage.src = 'My Invitation.jpeg';
        
        const thumbnailText = document.createElement('span');
        thumbnailText.textContent = index === 0 ? 'Front Page' : `Page ${index + 1}`;
        
        thumbnailContainer.appendChild(thumbnailImage);
        thumbnailContainer.appendChild(thumbnailText);
        
        thumbnailContainer.addEventListener('click', () => {
            currentPage = index;
            renderCurrentPage();
            updatePageNavigation();
        });
        
        const addPageThumbnail = pageListContainer.querySelector('.add-page').parentElement;
        pageListContainer.insertBefore(thumbnailContainer, addPageThumbnail);

        const pageCard = document.createElement('div');
        pageCard.className = 'page-card';
        
        const cardImage = document.createElement('img');
        cardImage.src = 'My Invitation.jpeg';
        cardImage.alt = `Page ${index + 1}`;
        
        const cardActions = document.createElement('div');
        cardActions.className = 'page-card-actions';
        
        if (index !== 0) {
            const deleteButton = document.createElement('button');
            deleteButton.innerHTML = '<i class="fas fa-trash"></i>';
            deleteButton.addEventListener('click', (e) => {
                e.stopPropagation();
                deletePage(index);
            });
            cardActions.appendChild(deleteButton);
        }
        
        pageCard.appendChild(cardImage);
        pageCard.appendChild(cardActions);
        
        const addPageCard = customizePagesGrid.querySelector('.add-page-card');
        customizePagesGrid.insertBefore(pageCard, addPageCard);
    });
}

function renderCurrentPage() {
    const weddingCard = document.getElementById('weddingCard');
    weddingCard.innerHTML = ''; 

    if (pages[currentPage]) {
        const pageContent = pages[currentPage].cloneNode(true);
        Array.from(pageContent.children).forEach(child => {
            const clonedChild = child.cloneNode(true);
            setupDraggable(clonedChild);
            setupTextBoxListeners(clonedChild);
            weddingCard.appendChild(clonedChild);
        });

        weddingCard.style.backgroundImage = "url('My Invitation.jpeg')";
    }

    const thumbnails = document.querySelectorAll('.page-thumbnail');
    thumbnails.forEach((thumbnail, index) => {
        if (index === currentPage) {
            thumbnail.classList.add('selected');
        } else {
            thumbnail.classList.remove('selected');
        }
    });
}

function updatePageNavigation() {
    const prevBtn = document.querySelector('.nav-prev');
    const nextBtn = document.querySelector('.nav-next');
    
    if (prevBtn) prevBtn.disabled = currentPage <= 0;
    if (nextBtn) nextBtn.disabled = currentPage >= pages.length - 1;
    
    const pageIndicator = document.createElement('div');
    pageIndicator.className = 'page-indicator';
    pageIndicator.textContent = `Page ${currentPage + 1} of ${pages.length}`;
    
    const editorMain = document.querySelector('.editor-main');
    const existingIndicator = editorMain.querySelector('.page-indicator');
    if (existingIndicator) {
        existingIndicator.replaceWith(pageIndicator);
    } else {
        editorMain.appendChild(pageIndicator);
    }
}

function deletePage(index) {
    if (pages.length <= 1) {
        alert("At least one page is required.");
        return;
    }

    pages.splice(index, 1);
    if (currentPage >= pages.length) {
        currentPage = pages.length - 1;
    }
    updatePageThumbnails();
    renderCurrentPage();
    updatePageNavigation();
}

function saveToLocalStorage() {
    const weddingCard = document.getElementById('weddingCard');
    const textBoxes = weddingCard.querySelectorAll('.textBox');

    const savedPages = pages.map(page => {
        const pageTextBoxes = Array.from(page.querySelectorAll('.textBox')).map(box => ({
            id: box.id,
            value: box.value,
            style: box.style.cssText,
            top: box.style.top,
            left: box.style.left
        }));
        return pageTextBoxes;
    });

    const savedData = {
        title: document.getElementById('cardTitle').textContent,
        pages: savedPages
    };

    localStorage.setItem('weddingInvitation', JSON.stringify(savedData));
    showToast('Invitation saved successfully!');
}

function loadFromLocalStorage() {
    const savedData = localStorage.getItem('weddingInvitation');
    if (savedData) {
        const parsedData = JSON.parse(savedData);
        document.getElementById('cardTitle').textContent = parsedData.title;
        
        pages = [];
        const weddingCard = document.getElementById('weddingCard');
        weddingCard.innerHTML = '';

        parsedData.pages.forEach(pageTextBoxes => {
            const newPageContainer = document.createElement('div');
            newPageContainer.className = 'page-container';
            newPageContainer.style.backgroundImage = "url('My Invitation.jpeg')";
            
            pageTextBoxes.forEach(box => {
                const textBox = createTextBox(box.value);
                textBox.id = box.id;
                textBox.style.cssText = box.style;
                textBox.style.top = box.top;
                textBox.style.left = box.left;
                newPageContainer.appendChild(textBox);
            });
            
            pages.push(newPageContainer);
        });
        
        currentPage = 0;
        renderCurrentPage();
        updatePageNavigation();
        updatePageThumbnails();
    }
}

function generatePDF() {
    showToast('Cant implement without using external libraries');
}

function showToast(message) {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => {
        toast.remove();
    }, 3000);
}

function setupMoreOptionsListeners() {
    const moreOptionsModal = document.getElementById('moreOptionsModal');
    const changeBackgroundBtn = document.getElementById('changeBackgroundBtn');
    const borderStyleBtn = document.getElementById('borderStyleBtn');
    const layersBtn = document.getElementById('layersBtn');
    const effectsBtn = document.getElementById('effectsBtn');

    changeBackgroundBtn.addEventListener('click', changeBackground);
    borderStyleBtn.addEventListener('click', changeBorderStyle);
    layersBtn.addEventListener('click', manageLayers);
    effectsBtn.addEventListener('click', applyEffects);
}

function changeBackground() {
    const backgroundInput = document.createElement('input');
    backgroundInput.type = 'file';
    backgroundInput.accept = 'image/*';
    backgroundInput.onchange = function(event) {
        const file = event.target.files[0];
        const reader = new FileReader();
        reader.onload = function(e) {
            document.getElementById('weddingCard').style.backgroundImage = `url('${e.target.result}')`;
        };
        reader.readAsDataURL(file);
    };
    backgroundInput.click();
}

function changeBorderStyle() {
    const borderStyles = ['none', 'solid', 'dashed', 'dotted', 'double'];
    const currentStyle = document.getElementById('weddingCard').style.borderStyle || 'none';
    const nextIndex = (borderStyles.indexOf(currentStyle) + 1) % borderStyles.length;
    document.getElementById('weddingCard').style.border = `5px ${borderStyles[nextIndex]} #000`;
}

function manageLayers() {
    showToast("404");
}

function applyEffects() {
    const effects = ['none', 'sepia(50%)', 'grayscale(50%)', 'blur(2px)', 'brightness(120%)'];
    const currentEffect = document.getElementById('weddingCard').style.filter || 'none';
    const nextIndex = (effects.indexOf(currentEffect) + 1) % effects.length;
    document.getElementById('weddingCard').style.filter = effects[nextIndex];
}

document.addEventListener('DOMContentLoaded', initializeEditor);


// bugs: thumbnail and changeBackground lot of bugs 
// render pages destroys changeBackground cba