document.addEventListener('DOMContentLoaded', () => {
    const generateButton = document.getElementById('generate-button');
    const urlsInput = document.getElementById('urls-input');
    const markdownInput = document.getElementById('markdown-input');

    generateButton.addEventListener('click', () => {
        const urls = urlsInput.value.split('\n').map(line => line.trim()).filter(line => line.length > 0);
        
        if (urls.length === 0) {
            alert('Пожалуйста, вставьте хотя бы один URL.');
            return;
        }

        const photos = urls.map((url, index) => ({
            id: index + 1,
            url: url,
            caption: `Фото №${index + 1}`,
            isOutOfCompetition: false,
            votes: 0
        }));

        const introMarkdown = markdownInput.value.trim();

        const finalJson = {
            introArticleMarkdown: introMarkdown,
            photos: photos
        };

        const blob = new Blob([JSON.stringify(finalJson, null, 2)], { type: 'application/json;charset=utf-8' });
        const objectUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = objectUrl;
        a.download = 'photos.json';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(objectUrl);
    });
});
