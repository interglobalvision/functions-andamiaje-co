const imageSizes = [350, 750, 1536, 2048, 4608];

let IMAGE_SIZES = [
  ...imageSizes.map( size => ({
    prefix: size,
    width: size
  })),
  ...imageSizes.map( size => ({
    prefix: `${size}x${size}`,
    width: size,
    height: size
  }))
];

module.exports = IMAGE_SIZES;
