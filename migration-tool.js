document.addEventListener('DOMContentLoaded', () => {
    const sessionIdInput = document.getElementById('session-id');
    const configFile_input = document.getElementById('config-file');
    const photosFile_input = document.getElementById('photos-file');
    const generateButton = document.getElementById('generate-button');
    const resultContainer = document.getElementById('result-container');
    const jsonOutput = document.getElementById('json-output');

    let configData = null;
    let photosData = null;

    const readFile = (file) => {
        return new Promise((resolve, reject) => {
            if (!file) {
                return reject(new Error('Файл не выбран.'));
            }
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const json = JSON.parse(e.target.result);
                    resolve(json);
                } catch (err) {
                    reject(new Error(`Ошибка парсинга JSON в файле ${file.name}: ${err.message}`));
                }
            };
            reader.onerror = (e) => reject(new Error(`Ошибка чтения файла ${file.name}`));
            reader.readAsText(file, 'UTF-8');
        });
    };

    configFile_input.addEventListener('change', async (e) => {
        try {
            configData = await readFile(e.target.files[0]);
        } catch (err) {
            alert(err.message);
            configData = null;
        }
    });

    photosFile_input.addEventListener('change', async (e) => {
        try {
            photosData = await readFile(e.target.files[0]);
        } catch (err) {
            alert(err.message);
            photosData = null;
        }
    });

    generateButton.addEventListener('click', () => {
        const sessionId = sessionIdInput.value.trim();
        if (!sessionId) {
            alert('Пожалуйста, введите ID сессии.');
            return;
        }
        if (!configData) {
            alert('Пожалуйста, загрузите файл config.json.');
            return;
        }
        if (!photosData) {
            alert('Пожалуйста, загрузите файл photos.json.');
            return;
        }

        // Clean up config
        delete configData.photosPath;
        delete configData.resultsPath;

        // Initialize votes
        const votes = {};
        if (photosData.photos && Array.isArray(photosData.photos)) {
            photosData.photos.forEach(photo => {
                votes[photo.id] = 0;
            });
        }
        
        // Clean up photos data (remove votes property from each photo)
        const cleanedPhotos = photosData.photos.map(({ votes, ...rest }) => rest);
        const finalPhotosData = {
            ...photosData,
            photos: cleanedPhotos
        };

        const finalJson = {
            config: configData,
            photos: finalPhotosData,
            votes: votes,
        };

        jsonOutput.value = JSON.stringify(finalJson, null, 2);
        resultContainer.classList.remove('hidden');
    });
});