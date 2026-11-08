const fs = require('node:fs');

class Settings {
  constructor(file, defaults) {
    this.file = file;
    let saved = {};
    try {
      saved = JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch { /* 첫 실행이거나 손상된 파일이면 기본값으로 시작 */ }
    this.values = { ...defaults, ...saved };
  }

  set(patch) {
    Object.assign(this.values, patch);
    const tmp = `${this.file}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(this.values));
    fs.renameSync(tmp, this.file);
  }
}

module.exports = { Settings };
