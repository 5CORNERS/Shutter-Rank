document.addEventListener('DOMContentLoaded', () => {
    const photoContainer = document.getElementById('photo-container');
    const downloadButton = document.getElementById('download-button');
    const extractExifButton = document.getElementById('extract-exif-button');
    const loader = document.getElementById('loader');
    const editorContainer = document.getElementById('editor-container');
    const markdownEditor = document.getElementById('markdown-editor');

    let photosData = [];
    let introArticleMarkdown = "";
    let draggedElement = null;
    let currentConfig = null;

    const loadData = async () => {
        try {
            loader.style.display = 'block';
            editorContainer.classList.add('hidden');

            const configResponse = await fetch(`./config.json?cache-bust=${new Date().getTime()}`);
            if (!configResponse.ok) {
                throw new Error(`Не удалось загрузить config.json: ${configResponse.statusText}`);
            }
            const config = await configResponse.json();
            currentConfig = config;

            if (!config.photosPath) {
                throw new Error('В файле config.json не найден путь к файлу фотографий (photosPath).');
            }

            const photosResponse = await fetch(`${config.photosPath}?cache-bust=${new Date().getTime()}`);
            if (!photosResponse.ok) {
                throw new Error(`Не удалось загрузить файл фотографий из ${config.photosPath}: ${photosResponse.statusText}`);
            }
            const jsonData = await photosResponse.json();

            introArticleMarkdown = jsonData.introArticleMarkdown || "";
            photosData = jsonData.photos || [];

            markdownEditor.value = introArticleMarkdown;
            renderPhotos();
            editorContainer.classList.remove('hidden');
            downloadButton.disabled = false;
            extractExifButton.disabled = false;

        } catch (error) {
            photoContainer.innerHTML = `<p class="text-red-400 text-center">Ошибка: ${error.message}</p>`;
        } finally {
            loader.style.display = 'none';
        }
    };

    const renderPhotos = () => {
        photoContainer.innerHTML = '';
        photosData.forEach((photo) => {
            const photoElement = document.createElement('div');
            photoElement.className = 'flex items-start gap-4 p-4 bg-gray-900 rounded-lg border border-gray-700 transition-opacity duration-300';
            photoElement.dataset.id = photo.id;
            photoElement.draggable = true;

            photoElement.innerHTML = `
                <div class="drag-handle text-gray-500 cursor-grab self-center pt-8" title="Перетащить для изменения порядка">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-6 h-6"><path d="M9 18v-6l-2 2M9 6v6l2-2m6-2v6l2-2m-2-4v-6l-2 2"/></svg>
                </div>
                <div class="w-24 h-24 md:w-48 md:h-48 flex-shrink-0">
                    <img id="img-${photo.id}" src="${photo.url}" alt="Фото ${photo.id}" class="rounded-md w-full h-full object-cover" crossorigin="anonymous">
                </div>
                <div class="w-full">
                    <label for="caption-${photo.id}" class="block text-sm font-medium text-gray-400 mb-1">Описание для фото №${photo.id}:</label>
                    <textarea id="caption-${photo.id}" rows="4" class="w-full p-2 border border-gray-600 rounded-md bg-gray-700 text-white focus:ring-indigo-500 focus:border-indigo-500">${photo.caption}</textarea>
                    <div class="mt-2 space-y-1">
                        <label class="flex items-center space-x-2 text-sm text-gray-300 cursor-pointer">
                            <input type="checkbox" id="flagged-${photo.id}" class="h-4 w-4 rounded border-gray-500 bg-gray-600 text-indigo-600 focus:ring-indigo-500" ${photo.isFlagged !== false ? "checked" : ""}>
                            <span>Flagged</span>
                        </label>
                        <label class="flex items-center space-x-2 text-sm text-gray-300 cursor-pointer">
                            <input type="checkbox" id="outofcomp-${photo.id}" class="h-4 w-4 rounded border-gray-500 bg-gray-600 text-indigo-600 focus:ring-indigo-500" ${photo.isOutOfCompetition ? "checked" : ""}>
                            <span>Out of Competition</span>
                        </label>
                    </div>
                </div>
            `;
            photoContainer.appendChild(photoElement);
        });
    };

    const updateDataFromDOM = () => {
        const newPhotosData = [];
        const currentPhotoElements = Array.from(photoContainer.querySelectorAll('[data-id]'));

        currentPhotoElements.forEach(element => {
            const id = parseInt(element.dataset.id, 10);
            const originalPhoto = photosData.find(p => p.id === id);
            if (originalPhoto) {
                const updatedPhoto = { ...originalPhoto };
                const textarea = element.querySelector(`textarea`);
                updatedPhoto.caption = textarea ? textarea.value : originalPhoto.caption;

                const isFlaggedCheckbox = element.querySelector(`input[id^="flagged-"]`);
                updatedPhoto.isFlagged = isFlaggedCheckbox ? isFlaggedCheckbox.checked : true;

                const isOutOfCompetitionCheckbox = element.querySelector(`input[id^="outofcomp-"]`);
                updatedPhoto.isOutOfCompetition = isOutOfCompetitionCheckbox ? isOutOfCompetitionCheckbox.checked : false;

                newPhotosData.push(updatedPhoto);
            }
        });

        photosData = newPhotosData;
    };

    const reassignIdsAndRerender = () => {
        updateDataFromDOM();
        photosData.forEach((photo, index) => {
            photo.id = index + 1;
        });
        renderPhotos();
    };


    photoContainer.addEventListener('dragstart', (e) => {
        if (e.target.matches('[draggable="true"]')) {
            draggedElement = e.target;
            setTimeout(() => e.target.classList.add('dragging'), 0);
        }
    });

    photoContainer.addEventListener('dragend', () => {
        if (draggedElement) {
            draggedElement.classList.remove('dragging');

            const placeholder = photoContainer.querySelector('.drag-over-placeholder');
            if (placeholder) {
                // This is the key: update the position of the dragged element in the DOM
                // before updating the data array.
                placeholder.parentNode.insertBefore(draggedElement, placeholder);
                placeholder.remove();
            }

            draggedElement = null;
            reassignIdsAndRerender();
        }
    });

    photoContainer.addEventListener('dragover', (e) => {
        e.preventDefault();
        const afterElement = getDragAfterElement(photoContainer, e.clientY);
        const placeholder = photoContainer.querySelector('.drag-over-placeholder') || document.createElement('div');
        placeholder.className = 'drag-over-placeholder';

        if (afterElement == null) {
            photoContainer.appendChild(placeholder);
        } else {
            photoContainer.insertBefore(placeholder, afterElement);
        }
    });

    function getDragAfterElement(container, y) {
        const draggableElements = [...container.querySelectorAll('[draggable="true"]:not(.dragging)')];
        return draggableElements.reduce((closest, child) => {
            const box = child.getBoundingClientRect();
            const offset = y - box.top - box.height / 2;
            if (offset < 0 && offset > closest.offset) {
                return { offset: offset, element: child };
            } else {
                return closest;
            }
        }, { offset: Number.NEGATIVE_INFINITY }).element;
    }

    extractExifButton.addEventListener('click', async () => {
        if (!confirm('Это действие перезапишет текущие описания данными из EXIF. Продолжить?')) return;

        const originalText = extractExifButton.textContent;
        extractExifButton.textContent = 'Извлечение...';
        extractExifButton.disabled = true;

        for (const photo of photosData) {
            try {
                const exif = await exifr.parse(photo.url, { iptc: true, exif: true });
                if (exif && exif.ImageDescription) {
                    const textarea = document.getElementById(`caption-${photo.id}`);
                    if (textarea) textarea.value = exif.ImageDescription;
                }
            } catch (error) {
                console.warn(`Не удалось извлечь EXIF для фото ${photo.id}:`, error);
            }
        }
        alert('Извлечение EXIF завершено.');
        extractExifButton.textContent = originalText;
        extractExifButton.disabled = false;
    });

    downloadButton.addEventListener('click', () => {
        updateDataFromDOM(); // This ensures photosData is in the correct order with updated captions

        // This is the critical fix: re-assign IDs based on the new order.
        const finalPhotos = photosData.map((photo, index) => ({
            ...photo,
            id: index + 1
        }));

        const finalJson = {
            introArticleMarkdown: markdownEditor.value.trim(),
            photos: finalPhotos
        };

        const blob = new Blob([JSON.stringify(finalJson, null, 2)], { type: 'application/json;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const filename = currentConfig && currentConfig.photosPath
            ? currentConfig.photosPath.split('/').pop()
            : 'photos.json';
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    });

    loadData();
});