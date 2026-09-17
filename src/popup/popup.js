document.addEventListener('DOMContentLoaded', () => {
  const openBtn = document.getElementById('openOptions');
  if (openBtn) {
    openBtn.addEventListener('click', () => {
      chrome.runtime.openOptionsPage();
    });
  }
});