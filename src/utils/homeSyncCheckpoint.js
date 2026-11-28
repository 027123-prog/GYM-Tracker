let connection;

function openDatabase() {
  if (!connection) {
    connection = new Promise((resolve, reject) => {
      const request = indexedDB.open('hardgainwaf-home-sync', 1);
      request.onupgradeneeded = () => request.result.createObjectStore('servers', { keyPath: 'serverId' });
      request.onerror = () => { connection = null; reject(request.error); };
      request.onsuccess = () => {
        const db = request.result;
        db.onversionchange = () => { db.close(); connection = null; };
        resolve(db);
      };
    });
  }
  return connection;
}

export async function readCheckpoint(serverId) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const request = db.transaction('servers').objectStore('servers').get(serverId);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveCheckpoint(checkpoint) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('servers', 'readwrite');
    transaction.oncomplete = resolve;
    transaction.onabort = () => reject(transaction.error || new Error('Abgleich konnte nicht gespeichert werden.'));
    transaction.onerror = () => reject(transaction.error);
    transaction.objectStore('servers').put(checkpoint);
  });
}
