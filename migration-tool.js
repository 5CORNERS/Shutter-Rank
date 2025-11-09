document.addEventListener('DOMContentLoaded', () => {
    const sessionIdInput = document.getElementById('session-id');
    const configFile_input = document.getElementById('config-file');
    const photosFile_input = document.getElementById('photos-file');
    const resultsFile_input = document.getElementById('results-file');
    const generateButton = document.getElementById('generate-button');
    const resultContainer = document.getElementById('result-container');
    const jsonOutput = document.getElementById('json-output');

    let configData = null;
    let photosData = null;
    let resultsData = null;

    const readFile = (file) => {
        return new Promise((resolve, reject) => {
            if (!file) {
                // For optional files like results.json
                return resolve(null);
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

    resultsFile_input.addEventListener('change', async (e) => {
        try {
            resultsData = await readFile(e.target.files[0]);
        } catch (err) {
            alert(err.message);
            resultsData = null;
        }
    });


    generateButton.addEventListener('click', () => {
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

        let votes = {};
        if (resultsData) {
            // Use existing results if provided
            votes = resultsData;
        } else {
            // Initialize votes with 0 if no results file
            if (photosData.photos && Array.isArray(photosData.photos)) {
                photosData.photos.forEach(photo => {
                    votes[photo.id] = 0;
                });
            }
        }

        // Clean up photos data (remove votes property from each photo)
        const cleanedPhotos = photosData.photos.map(({ votes, ...rest }) => rest);
        const finalPhotosData = {
            ...photosData,
            photos: cleanedPhotos
        };

        const sessionObject = {
            config: configData,
            photos: finalPhotosData,
            votes: votes,
        };

        jsonOutput.value = JSON.stringify(sessionObject, null, 2);
        resultContainer.classList.remove('hidden');
    });
});
