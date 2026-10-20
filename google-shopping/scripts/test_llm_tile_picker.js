const { assertEq } = require('./assert');
const { createLlmTilePicker, targetFromPrompt } = require('../llm_tile_picker');

(async () => {
  assertEq(targetFromPrompt('Select all images with\nbuses\nClick verify once there are none left.'), 'a bus', 'buses');
  assertEq(targetFromPrompt('Select all squares with motorcycles If there are none, click skip'), 'a motorcycle', 'motorcycles');
  assertEq(targetFromPrompt('Select all images with a fire hydrant'), 'a fire hydrant', 'a fire hydrant');
  assertEq(targetFromPrompt('Select all images with stairs'), 'stairs', 'stairs');
  assertEq(targetFromPrompt(''), null, 'empty prompt');

  const quiet = () => {};
  const tilePaths = ['/x/tiles/0.png', '/x/tiles/1.png', '/x/tiles/2.png'];
  const ask = async (file) => ({ yes: file !== '/x/tiles/1.png' });
  process.env.LLM_CAPTCHA_ARCHIVE = '0';
  const pick = createLlmTilePicker({ log: quiet, ask });

  assertEq(await pick({ round: 1, tab: 0, prompt: 'Select all images with cars', tilePaths }), [0, 2], 'yes tiles');
  assertEq(await pick({ round: 3, tab: 0, prompt: 'Select all images with cars', tilePaths }), [], 'human after max rounds');
  assertEq(await pick({ round: 1, tab: 0, prompt: '', tilePaths }), [], 'no prompt → human');

  const broken = createLlmTilePicker({ log: quiet, ask: async () => { throw new Error('down'); } });
  assertEq(await broken({ round: 1, tab: 0, prompt: 'Select all images with cars', tilePaths }), [], 'ollama down → human');

  console.log('test_llm_tile_picker.js passed');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
