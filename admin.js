document.addEventListener('DOMContentLoaded', () => {
    // --- Config Management ---
    const loadConfigBtn = document.getElementById('load-config');
    const saveConfigBtn = document.getElementById('save-config');
    const configLoadStatus = document.getElementById('config-load-status');
    const ratedPhotoLimitInput = document.getElementById('rated-photo-limit');
    const totalStarsLimitInput = document.getElementById('total-stars-limit');
    const layoutDesktopSelect = document.getElementById('layout-desktop');
    const layoutMobileSelect = document.getElementById('layout-mobile');
    const gridAspectRatioSelect = document.getElementById('grid-aspect-ratio');
    const CONFIG_PATH = '/config.json';

    const loadConfig = async () => {
        configLoadStatus.textContent = `Загрузка из ${CONFIG_PATH}...`;
        configLoadStatus.classList.remove('text-red-500', 'text-green-500');
        try {
            const response = await fetch(`${CONFIG_PATH}?cache-bust=${new Date().getTime()}`, { cache: 'no-store' });
            if (!response.ok) {
                throw new Error(`Ошибка сети: ${response.statusText} (статус: ${response.status})`);
            }
            const data = await response.json();

            ratedPhotoLimitInput.value = data.ratedPhotoLimit;
            totalStarsLimitInput.value = data.totalStarsLimit;
            layoutDesktopSelect.value = data.defaultLayoutDesktop;
            layoutMobileSelect.value = data.defaultLayoutMobile;
            gridAspectRatioSelect.value = data.defaultGridAspectRatio || '4/3';

            configLoadStatus.textContent = `Успешно загружено из ${CONFIG_PATH}`;
            configLoadStatus.classList.add('text-green-500');
        } catch (error) {
            console.error('Ошибка загрузки config.json:', error);
            configLoadStatus.textContent = `Ошибка: ${error.message}. Убедитесь, что файл существует и доступен.`;
            configLoadStatus.classList.add('text-red-500');
        }
    };

    saveConfigBtn.addEventListener('click', () => {
        const configData = {
            photosPath: "./data/photos.json",
            resultsPath: "./data/results.json",
            defaultLayoutDesktop: layoutDesktopSelect.value,
            defaultLayoutMobile: layoutMobileSelect.value,
            defaultGridAspectRatio: gridAspectRatioSelect.value,
            ratedPhotoLimit: parseInt(ratedPhotoLimitInput.value, 10),
            totalStarsLimit: parseInt(totalStarsLimitInput.value, 10),
        };

        if (isNaN(configData.ratedPhotoLimit) || isNaN(configData.totalStarsLimit)) {
            alert('Лимиты должны быть числами.');
            return;
        }

        const blob = new Blob([JSON.stringify(configData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'config.json';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    });

    loadConfigBtn.addEventListener('click', loadConfig);

    // --- Vote Merging ---
    const loadButton = document.getElementById('load-current');
    const mergeButton = document.getElementById('merge-button');
    const copyButton = document.getElementById('copy-button');
    const downloadButton = document.getElementById('download-button');
    const currentResultsTextarea = document.getElementById('current-results');
    const userVotesTextarea = document.getElementById('user-votes');
    const newResultsTextarea = document.getElementById('new-results');
    const loadStatus = document.getElementById('load-status');
    let currentConfig = null;

    const checkNewResults = () => {
        const hasContent = newResultsTextarea.value.trim() !== '';
        copyButton.disabled = !hasContent;
        downloadButton.disabled = !hasContent;
    };

    const loadInitialData = async () => {
        try {
            const response = await fetch(`${CONFIG_PATH}?cache-bust=${new Date().getTime()}`, { cache: 'no-store' });
            if (!response.ok) throw new Error('Не удалось загрузить config.json');
            currentConfig = await response.json();
            await loadConfig();
            await loadResults();
        } catch(error) {
            loadStatus.textContent = `Критическая ошибка: ${error.message}`;
            loadStatus.classList.add('text-red-500');
        }
    }

    const loadResults = async () => {
        if (!currentConfig || !currentConfig.resultsPath) {
            loadStatus.textContent = 'Ошибка: Путь к файлу результатов не найден в config.json.';
            loadStatus.classList.add('text-red-500');
            return;
        }
        const RESULTS_PATH = currentConfig.resultsPath.replace('./', '/');
        loadStatus.textContent = `Загрузка из ${RESULTS_PATH}...`;
        loadStatus.classList.remove('text-red-500', 'text-green-500', 'text-yellow-500');
        try {
            const response = await fetch(`${RESULTS_PATH}?cache-bust=${new Date().getTime()}`, { cache: 'no-store' });
            if (!response.ok) {
                if (response.status === 404) {
                    currentResultsTextarea.value = '{}';
                    throw new Error(`Файл не найден. Будет создан новый файл с результатами.`);
                }
                throw new Error(`Ошибка сети: ${response.statusText}`);
            }
            const data = await response.json();
            currentResultsTextarea.value = JSON.stringify(data, null, 2);
            loadStatus.textContent = `Успешно загружено из ${RESULTS_PATH}`;
            loadStatus.classList.add('text-green-500');
        } catch (error) {
            console.error('Ошибка загрузки results.json:', error);
            if (currentResultsTextarea.value === '') {
                currentResultsTextarea.value = '{}';
            }
            loadStatus.textContent = `Информация: ${error.message}`;
            loadStatus.classList.add('text-yellow-500');
        }
    };

    loadButton.addEventListener('click', loadResults);

    mergeButton.addEventListener('click', () => {
        try {
            const currentResults = JSON.parse(currentResultsTextarea.value || '{}');
            const userVotes = JSON.parse(userVotesTextarea.value || '{}');

            if (typeof currentResults !== 'object' || currentResults === null || Array.isArray(currentResults)) {
                throw new Error("Текущие результаты должны быть JSON-объектом.");
            }
            if (typeof userVotes !== 'object' || userVotes === null || Array.isArray(userVotes)) {
                throw new Error("Голоса пользователя должны быть JSON-объектом.");
            }

            const newResults = { ...currentResults };

            for (const photoId in userVotes) {
                if (Object.prototype.hasOwnProperty.call(userVotes, photoId)) {
                    const rating = userVotes[photoId];
                    const currentScore = newResults[photoId] || 0;

                    if (typeof rating === 'number' && rating >= 1 && rating <= 5) {
                        newResults[photoId] = currentScore + rating;
                    }
                }
            }

            const newResultsString = JSON.stringify(newResults, null, 2);
            newResultsTextarea.value = newResultsString;
            currentResultsTextarea.value = newResultsString;

            userVotesTextarea.value = '';
            checkNewResults();

            loadStatus.textContent = `Результаты объединены. Готово к слиянию со следующим пользователем.`;
            loadStatus.classList.remove('text-red-500', 'text-yellow-500');
            loadStatus.classList.add('text-green-500');

        } catch (error) {
            alert(`Ошибка объединения: ${error.message}. Проверьте корректность JSON.`);
            console.error(error);
        }
    });

    copyButton.addEventListener('click', () => {
        if (!newResultsTextarea.value) return;
        navigator.clipboard.writeText(newResultsTextarea.value).then(() => {
            const originalText = copyButton.textContent;
            copyButton.textContent = 'Скопировано!';
            setTimeout(() => { copyButton.textContent = originalText; }, 2000);
        }).catch(err => {
            console.error('Ошибка копирования: ', err);
            alert('Не удалось скопировать текст.');
        });
    });

    downloadButton.addEventListener('click', () => {
        if (!newResultsTextarea.value) return;
        const blob = new Blob([newResultsTextarea.value], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'results.json';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    });

    newResultsTextarea.addEventListener('input', checkNewResults);

    // Initial setup
    loadInitialData();
    checkNewResults();
});