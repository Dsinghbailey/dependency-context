// Mock for @xenova/transformers
const pipeline = jest.fn().mockImplementation(() => {
  return Promise.resolve((text) => {
    return Promise.resolve({
      data: new Float32Array([0.1, 0.2, 0.3])
    });
  });
});

module.exports = {
  pipeline
};