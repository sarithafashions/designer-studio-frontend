// Shrinks a photo in the browser before it is uploaded: longest side at most MAX_SIDE px, saved as JPEG.
// A phone photo (3–8 MB) becomes ~200–500 KB, so uploads are fast on shop Wi-Fi and the server and storage carry
// far less. The original file is returned when it is already small, is not a normal photo (GIF / SVG), cannot be
// decoded by this browser (e.g. HEIC on some phones), or would not get smaller.

const MAX_SIDE = 1600;
const QUALITY = 0.82;
const SKIP_BELOW_BYTES = 400 * 1024;

async function decode(file) {
    if (typeof createImageBitmap === "function") {
        try {
            return await createImageBitmap(file, { imageOrientation: "from-image" }); // keeps phone rotation
        } catch {
            // fall back to <img>
        }
    }
    const url = URL.createObjectURL(file);
    try {
        const img = new Image();
        img.src = url;
        await img.decode();
        return img;
    } finally {
        URL.revokeObjectURL(url);
    }
}

/** @returns {Promise<File>} a smaller JPEG, or the original file */
export async function compressImage(file) {
    if (!file || !file.type?.startsWith("image/") || /gif|svg/.test(file.type) || file.size <= SKIP_BELOW_BYTES) {
        return file;
    }
    try {
        const image = await decode(file);
        const width = image.width;
        const height = image.height;
        const scale = Math.min(1, MAX_SIDE / Math.max(width, height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(width * scale);
        canvas.height = Math.round(height * scale);
        const ctx = canvas.getContext("2d");
        ctx.fillStyle = "#ffffff"; // transparent PNG areas become white, not black
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
        image.close?.();
        const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", QUALITY));
        if (!blob || blob.size >= file.size) return file;
        const name = (file.name || "photo").replace(/\.[^.]+$/, "") + ".jpg";
        return new File([blob], name, { type: "image/jpeg", lastModified: Date.now() });
    } catch {
        return file;
    }
}
