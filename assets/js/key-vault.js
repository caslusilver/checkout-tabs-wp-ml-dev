(() => {
    const button = document.getElementById('ctwpml-generate-key');
    const input = document.getElementById('ctwpml-new-key');
    if (!button || !input) return;
    button.addEventListener('click', () => {
        const bytes = crypto.getRandomValues(new Uint8Array(32));
        input.value = Array.from(bytes, value => value.toString(16).padStart(2, '0')).join('');
        input.type = 'text';
    });
})();
