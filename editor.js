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
    const PHOTOS_PATH = '/data/photos.json';

    const loadData = async () => {
        try {
            loader.style.display = 'block';
            editorContainer.classList.add('hidden');

            const response = await fetch(`${PHOTOS_PATH}?cache-bust=${new Date().getTime()}`);
            if (!response.ok) {
                throw new Error(`Не удалось загрузить файл: ${response.statusText}`);
            }
            const jsonData = await response.json();

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
            photoElement.className = 'flex items-center gap-4 p-4 bg-gray-900 rounded-lg border border-gray-700 transition-opacity duration-300';
            photoElement.dataset.id = photo.id;
            photoElement.draggable = true;

            photoElement.innerHTML = `
                <div class="drag-handle text-gray-500 cursor-grab self-center" title="Перетащить для изменения порядка">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-6 h-6"><path d="M9 18v-6l-2 2M9 6v6l2-2m6-2v6l2-2m-2-4v-6l-2 2"/></svg>
                </div>
                <div class="w-24 h-24 md:w-48 md:h-48 flex-shrink-0">
                    <img id="img-${photo.id}" src="${photo.url}" alt="Фото ${photo.id}" class="rounded-md w-full h-full object-cover" crossorigin="anonymous">
                </div>
                <div class="w-full">
                    <label for="caption-${photo.id}" class="block text-sm font-medium text-gray-400 mb-1">Описание для фото №${photo.id}:</label>
                    <textarea id="caption-${photo.id}" rows="4" class="w-full p-2 border border-gray-600 rounded-md bg-gray-700 text-white focus:ring-indigo-500 focus:border-indigo-500">${photo.caption}</textarea>
                </div>
            `;
            photoContainer.appendChild(photoElement);
        });
    };

    const saveAndRerender = () => {
        const newPhotosData = [];
        const currentPhotoElements = Array.from(photoContainer.children);

        for (const element of currentPhotoElements) {
            if (!element.dataset.id) continue;
            const photoId = parseInt(element.dataset.id, 10);
            const originalPhoto = photosData.find(p => p.id === photoId);
            if (originalPhoto) {
                const textarea = element.querySelector(`#caption-${photoId}`);
                originalPhoto.caption = textarea ? textarea.value : originalPhoto.caption;
                newPhotosData.push(originalPhoto);
            }
        }
        photosData = newPhotosData;
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
            draggedElement = null;

            const placeholder = photoContainer.querySelector('.drag-over-placeholder');
            if (placeholder) placeholder.remove();

            saveAndRerender();
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

        const draggingElement = photoContainer.querySelector('.dragging');
        if (draggingElement) {
            photoContainer.insertBefore(draggingElement, placeholder);
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
        const currentPhotoElements = Array.from(photoContainer.children);
        const updatedPhotos = currentPhotoElements.map(element => {
            if (!element.dataset.id) return null;
            const photoId = parseInt(element.dataset.id, 10);
            // Find the original photo data based on ID, regardless of its current position in photosData
            const originalPhotoData = photosData.find(p => p.id === photoId);
            const textarea = element.querySelector(`#caption-${photoId}`);
            const newCaption = textarea ? textarea.value.trim() : originalPhotoData.caption;
            return { ...originalPhotoData, caption: newCaption };
        }).filter(Boolean);


        const finalJson = {
            introArticleMarkdown: markdownEditor.value.trim(),
            photos: updatedPhotos
        };

        const blob = new Blob([JSON.stringify(finalJson, null, 2)], { type: 'application/json;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'photos.json';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    });

    loadData();
});