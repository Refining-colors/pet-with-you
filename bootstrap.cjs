// Packaged launches must dispatch the DPI probe before taking the application lock.
if (process.argv.includes('--dsh-pet-dpi-probe') || process.env.DSH_PET_DPI_PROBE === '1') {
  require('./runtime/main.js');
} else if (process.argv.includes('--launch-client')) {
  require('./client-launcher-entry.cjs');
} else {
  require('./main.cjs');
}
