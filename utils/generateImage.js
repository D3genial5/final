const Jimp = require('jimp');

async function generarImagenCarton(numbers, outputPath) {
  const width = 600;
  const height = 300;
  const cellWidth = 100;
  const cellHeight = 100;

  const image = new Jimp(width, height, 0xffffffff);

  const font = await Jimp.loadFont(Jimp.FONT_SANS_32_BLACK);

  for (let row = 0; row < numbers.length; row++) {
    for (let col = 0; col < numbers[row].length; col++) {
      const number = numbers[row][col];
      const x = col * cellWidth + 10;
      const y = row * cellHeight + 10;
      image.print(font, x, y, number.toString());
    }
  }

  await image.writeAsync(outputPath);
  console.log(`Imagen generada en ${outputPath}`);
}

module.exports = { generarImagenCarton };
