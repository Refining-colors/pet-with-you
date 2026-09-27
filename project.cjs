const path = require('node:path');
const os = require('node:os');

const PRODUCT_NAME = 'pet-with-you';
const MAINTAINER = 'Refining-colors';
const REPOSITORY_URL = 'https://github.com/Refining-colors/pet-with-you';
const MAINTAINER_URL = 'https://github.com/Refining-colors';
const UPSTREAM_URL = 'https://github.com/PC2005-cloud/dsh-pet';
// Keep the established directory so upgrades retain keys, positions and hooks.
const DATA_DIRECTORY_NAME = 'DSH Pet Companion';
function dataDirectory(appData = process.env.APPDATA || os.homedir()) {
  return process.env.PET_TEST_DATA_DIR || process.env.PET_DEV_DATA_DIR || path.join(appData, DATA_DIRECTORY_NAME);
}
module.exports = { PRODUCT_NAME, MAINTAINER, REPOSITORY_URL, MAINTAINER_URL, UPSTREAM_URL, DATA_DIRECTORY_NAME, dataDirectory };
