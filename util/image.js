const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

async function resizeAndSaveImage(file, newFilename) {
    const resizedFilePath = path.join(__dirname, '../public/uploads', newFilename);
    await sharp(file.filepath).resize({
        width: 512,
        height: 512,
        fit: sharp.fit.inside,
        withoutEnlargement: true,
    }).toFile(resizedFilePath);
    return resizedFilePath;
}

function deleteExistingImage(imageName) {
    const imagePath = path.join(__dirname, '../public/uploads', imageName);
    if (fs.existsSync(imagePath)) {
        fs.unlinkSync(imagePath);
    }
}

exports.resizeAndSaveImage = resizeAndSaveImage;
exports.deleteExistingImage = deleteExistingImage;
