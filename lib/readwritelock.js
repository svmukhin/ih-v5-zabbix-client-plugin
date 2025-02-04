class ReadWriteLock {
  constructor() {
    this.readers = 0;
    this.writers = 0;
    this.readQueue = [];
    this.writQueue = [];
  }

  async readLock() {
    if (this.writers > 0 || this.writQueue.length > 0) {
      await new Promise((resolve) => {
        this.readQueue.push(resolve);
      });
    }
    this.readers++;
  }

  readUnlock() {
    this.readers--;
    if (this.readers === 0 && this.writQueue.length > 0) {
      const nextWriter = this.writQueue.shift();
      nextWriter();
    }
  }

  async writeLock() {
    if (this.readers > 0 || this.writers > 0) {
      await new Promise((resolve) => {
        this.writQueue.push(resolve);
      });
    }
    this.writers++;
  }

  writeUnlock() {
    this.writers--;
    if (this.writQueue.length > 0) {
      const nextWriter = this.writQueue.shift();
      nextWriter();
    } else if (this.readQueue.length > 0) {
      const nextReader = this.readQueue.shift();
      nextReader();
    }
  }
}

module.exports = ReadWriteLock;
