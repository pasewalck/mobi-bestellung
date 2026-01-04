const crypto = require('crypto');

exports.encryptPrivateKey = (privateKey, password) => {
    const salt = crypto.randomBytes(16);
    const key = crypto.scryptSync(password, salt, 32);
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
    const encrypted = cipher.update(privateKey, 'utf8', 'hex') + cipher.final('hex');;
    return Buffer.concat([iv, salt, Buffer.from(encrypted, 'hex')]).toString('hex');
}

exports.encryptWithPublicKey = (publicKey, data) => {
    const symmetricKey = crypto.randomBytes(32);
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', symmetricKey, iv);
    const encryptedData = cipher.update(data, 'utf8', 'base64') + cipher.final('base64');
    const encryptedKey = crypto.publicEncrypt(publicKey, symmetricKey).toString('base64');
    return `${encryptedKey}:${encryptedData}:${iv.toString('base64')}`;
}

exports.decryptWithPrivateKey = (privateKey, combinedString) => {
    const [encryptedKey, encryptedData, iv] = combinedString.split(':');
    const decryptedKey = crypto.privateDecrypt(privateKey, Buffer.from(encryptedKey, 'base64'));
    const decipher = crypto.createDecipheriv('aes-256-cbc', decryptedKey, Buffer.from(iv, 'base64'));
    const decrypted = decipher.update(encryptedData, 'base64', 'utf8') + decipher.final('utf8');
    return decrypted;
}

exports.decryptPrivateKey = (password, encryptedPrivateKey) => {
    const buffer = Buffer.from(encryptedPrivateKey, 'hex');
    const iv = buffer.subarray(0, 16);
    const salt = buffer.subarray(16, 32);
    const encryptedData = buffer.subarray(32).toString('hex');
    const key = crypto.scryptSync(password, salt, 32);
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
    const decrypted = decipher.update(encryptedData, 'hex', 'utf8') + decipher.final('utf8');
    return decrypted;
}

exports.generateKeyPair = () => {
    const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
        modulusLength: 2048,
    });
    return {
        publicKey: publicKey.export({ type: 'spki', format: 'pem' }),
        privateKey: privateKey.export({ type: 'pkcs8', format: 'pem' }),
    };
}