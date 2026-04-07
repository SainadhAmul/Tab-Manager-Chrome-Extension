document.addEventListener('DOMContentLoaded', () => {
    const currentTabsView = document.getElementById('current-tabs-view');
    const savedCollectionsView = document.getElementById('saved-collections-view');
    const viewCollectionsBtn = document.getElementById('view-collections-btn');
    const backBtn = document.getElementById('back-btn');
    const saveCollectionBtn = document.getElementById('save-collection-btn');
    
    const tabsListContainer = document.getElementById('tabs-list');
    const collectionsListContainer = document.getElementById('collections-list');

    let currentTabsData = [];

    // Navigation
    viewCollectionsBtn.addEventListener('click', () => {
        currentTabsView.classList.remove('active');
        savedCollectionsView.classList.add('active');
        loadSavedCollections();
    });

    backBtn.addEventListener('click', () => {
        savedCollectionsView.classList.remove('active');
        currentTabsView.classList.add('active');
    });

    // Load current tabs
    chrome.tabs.query({ currentWindow: true }, (tabs) => {
        currentTabsData = tabs.map(t => ({
            id: t.id,
            title: t.title,
            url: t.url,
            favIconUrl: t.favIconUrl
        }));
        renderCurrentTabs();
    });

    function renderCurrentTabs() {
        tabsListContainer.innerHTML = '';
        currentTabsData.forEach((tab, index) => {
            const div = document.createElement('div');
            div.className = 'tab-item';
            div.innerHTML = `
                <div class="tab-title" title="${tab.title}">
                    ${tab.favIconUrl ? `<img src="${tab.favIconUrl}" width="16" height="16" style="margin-right: 8px; border-radius: 2px;">` : ''}
                    ${tab.title}
                </div>
                <div class="tab-url" title="${tab.url}">${tab.url}</div>
                <textarea id="tab-desc-${index}" placeholder="Add a description for this tab (optional)"></textarea>
            `;
            tabsListContainer.appendChild(div);
        });
    }

    // Save collection
    saveCollectionBtn.addEventListener('click', () => {
        const titleInput = document.getElementById('collection-title').value.trim();
        const descInput = document.getElementById('collection-desc').value.trim();

        if (!titleInput) {
            alert('Please provide a title for the collection.');
            document.getElementById('collection-title').focus();
            return;
        }

        const tabsToSave = currentTabsData.map((tab, index) => {
            return {
                title: tab.title,
                url: tab.url,
                favIconUrl: tab.favIconUrl,
                description: document.getElementById(`tab-desc-${index}`).value.trim()
            };
        });

        const collection = {
            id: Date.now().toString(),
            title: titleInput,
            description: descInput,
            date: new Date().toISOString(),
            tabs: tabsToSave
        };

        chrome.storage.local.get(['collections'], (result) => {
            const collections = result.collections || [];
            collections.push(collection);
            chrome.storage.local.set({ collections }, () => {
                // Flash success state
                const originalText = saveCollectionBtn.textContent;
                saveCollectionBtn.textContent = 'Collection Saved!';
                saveCollectionBtn.style.backgroundColor = '#10b981'; // Tailwind Green 500
                saveCollectionBtn.style.color = '#fff';
                
                document.getElementById('collection-title').value = '';
                document.getElementById('collection-desc').value = '';
                renderCurrentTabs();

                setTimeout(() => {
                    saveCollectionBtn.textContent = originalText;
                    saveCollectionBtn.style.backgroundColor = '';
                    saveCollectionBtn.style.color = '';
                    
                    // Transition to collections view
                    currentTabsView.classList.remove('active');
                    savedCollectionsView.classList.add('active');
                    loadSavedCollections();
                }, 1000);
            });
        });
    });

    // Load saved collections
    function loadSavedCollections() {
        chrome.storage.local.get(['collections'], (result) => {
            const collections = result.collections || [];
            collectionsListContainer.innerHTML = '';
            
            if (collections.length === 0) {
                collectionsListContainer.innerHTML = '<div class="empty-state">No saved collections yet. Collect some tabs!</div>';
                return;
            }

            collections.slice().reverse().forEach(coll => {
                const date = new Date(coll.date).toLocaleString(undefined, {
                    dateStyle: 'medium', timeStyle: 'short'
                });
                
                const div = document.createElement('div');
                div.className = 'collection-item';
                div.innerHTML = `
                    <div class="collection-header">
                        <div class="collection-title">${coll.title}</div>
                        <div class="collection-date">${date}</div>
                    </div>
                    ${coll.description ? `<div class="collection-body" style="font-weight: 500; color: var(--text-primary); margin-bottom: 8px;">${coll.description}</div>` : ''}
                    <div class="collection-body">${coll.tabs.length} tabs saved.</div>
                    <div class="collection-actions">
                        <button class="primary-btn restore-btn" data-id="${coll.id}" style="margin:0; padding:6px 12px; font-size: 13px;">Restore</button>
                        <button class="secondary-btn export-btn" data-id="${coll.id}">Export</button>
                        <button class="danger-btn delete-btn" data-id="${coll.id}">Delete</button>
                    </div>
                `;
                collectionsListContainer.appendChild(div);
            });

            // Listeners
            document.querySelectorAll('.restore-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    restoreCollection(e.target.getAttribute('data-id'));
                });
            });

            document.querySelectorAll('.export-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    exportCollection(e.target.getAttribute('data-id'));
                });
            });

            document.querySelectorAll('.delete-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    deleteCollection(e.target.getAttribute('data-id'));
                });
            });
        });
    }

    function restoreCollection(id) {
        chrome.storage.local.get(['collections'], (result) => {
            const coll = (result.collections || []).find(c => c.id === id);
            if (coll) {
                chrome.windows.create({ focused: true, state: "maximized" }, (newWindow) => {
                    coll.tabs.forEach((t) => {
                        chrome.tabs.create({ windowId: newWindow.id, url: t.url });
                    });
                    
                    // Cleanup initial blank tab
                    setTimeout(() => {
                        chrome.tabs.query({ windowId: newWindow.id }, (tabs) => {
                             const blankTab = tabs.find(t => t.url === 'chrome://newtab/' || t.url === 'about:blank' || !t.url);
                             if (blankTab) chrome.tabs.remove(blankTab.id);
                        });
                    }, 800);
                });
            }
        });
    }

    function deleteCollection(id) {
        if(confirm('Are you sure you want to delete this collection?')) {
            chrome.storage.local.get(['collections'], (result) => {
                let collections = result.collections || [];
                collections = collections.filter(c => c.id !== id);
                chrome.storage.local.set({ collections }, () => {
                    loadSavedCollections(); // refresh
                });
            });
        }
    }

    function exportCollection(id) {
        chrome.storage.local.get(['collections'], (result) => {
            const coll = (result.collections || []).find(c => c.id === id);
            if (coll) {
                // Export as clean JSON
                const exportData = {
                    title: coll.title,
                    description: coll.description,
                    saved_at: coll.date,
                    tabs: coll.tabs.map(t => ({
                        title: t.title,
                        url: t.url,
                        description: t.description || ""
                    }))
                };
                const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(exportData, null, 2));
                const downloadAnchorNode = document.createElement('a');
                downloadAnchorNode.setAttribute("href", dataStr);
                downloadAnchorNode.setAttribute("download", `${coll.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_tabs.json`);
                document.body.appendChild(downloadAnchorNode);
                downloadAnchorNode.click();
                downloadAnchorNode.remove();
            }
        });
    }
});
