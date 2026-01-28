const Database = require('better-sqlite3');

const db = new Database('./orders.db');

db.exec(`CREATE TABLE IF NOT EXISTS campaignes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    publicKey BLOB NOT NULL,
    encryptedPrivateKey BLOB NOT NULL,
    destructionDate INTEGER DEFAULT NULL,
    name TEXT NOT NULL
);`);

db.exec(`CREATE TABLE IF NOT EXISTS items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    campaignId INTEGER NOT NULL,
    name TEXT NOT NULL,
    imageName TEXT,
    minQuantity INTEGER NOT NULL,
    maxQuantity INTEGER NOT NULL,
    FOREIGN KEY (campaignId) REFERENCES campaignes(id) ON DELETE CASCADE
);`);

db.exec(`CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    campaignId INTEGER NOT NULL,
    encryptedDetails TEXT NOT NULL,
    time INTEGER NOT NULL,
    FOREIGN KEY (campaignId) REFERENCES campaignes(id) ON DELETE CASCADE
);`);

exports.insertOrder = (campaignId, encryptedData) => {
    const insertOrder = db.prepare('INSERT INTO orders (campaignId,encryptedDetails, time) VALUES (?, ?, ?)');
    const orderId = insertOrder.run(campaignId, encryptedData, Date.now()).lastInsertRowid;
    return orderId
}

exports.getCampaigneById = (campaignId) => {
    return db.prepare('SELECT * FROM campaignes WHERE id = ?').get(campaignId);
}

exports.getItemsForcampaignId = (campaignId) => {
    return db.prepare('SELECT * FROM items WHERE campaignId = ?').all(campaignId);
}

exports.getOrders = (campaignId) => {
    return db.prepare('SELECT * FROM orders WHERE campaignId = ?').all(campaignId);
}

exports.getOrdersCount = (campaignId) => {
    return db.prepare('SELECT COUNT(*) FROM orders WHERE campaignId = ?').pluck().get(campaignId);
}

exports.getLimitedOrders = (campaignId, limit = 10, offset = 0) => {
    return db.prepare('SELECT * FROM orders WHERE campaignId = ? LIMIT ? OFFSET ?').all(campaignId, limit, offset);
}

exports.getOrder = (orderId) => {
    return db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
}

exports.getCampaine = (campaignId) => {
    return db.prepare('SELECT * FROM campaignes WHERE id = ?').get(campaignId);
}

exports.deleteItem = (itemId) => {
    const deleteItem = db.prepare('DELETE FROM items WHERE id = ?');
    deleteItem.run(itemId);
}

exports.updateItem = (name, minQuantity, maxQuantity, imageName, itemId) => {
    const updateItem = db.prepare('UPDATE items SET name = ?, minQuantity = ?, maxQuantity = ?, imageName = ? WHERE id = ?');
    updateItem.run(name, minQuantity, maxQuantity, imageName, itemId);
}

exports.updateOrder = (orderId, encryptedDetails) => {
    const updateItem = db.prepare('UPDATE orders SET encryptedDetails = ? WHERE id = ?');
    updateItem.run(encryptedDetails, orderId);
}

exports.insertItem = (campaignId, name, minQuantity, maxQuantity, imageName) => {
    const insertItem = db.prepare('INSERT INTO items (campaignId, name, minQuantity, maxQuantity, imageName) VALUES (?, ?, ?, ?, ?)');
    const result = insertItem.run(campaignId, name, minQuantity, maxQuantity, imageName);
    return result.lastInsertRowid;
}

exports.getOrdersForCampaigne = (campaignId) => {
    return db.prepare('SELECT COUNT(*) FROM orders WHERE campaignId = ?').all(campaignId);
}

exports.getItem = (itemId) => {
    return db.prepare('SELECT * FROM items WHERE id = ?').get(itemId)
}

exports.createCampaigne = (publicKey, encryptedPrivateKey, name) => {
    const insertCampaign = db.prepare('INSERT INTO campaignes (publicKey, encryptedPrivateKey, name) VALUES (?, ?, ?)');
    const result = insertCampaign.run(publicKey, encryptedPrivateKey, name);
    return result.lastInsertRowid;
}