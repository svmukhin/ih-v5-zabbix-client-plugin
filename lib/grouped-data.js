const Mutex = require("async-mutex").Mutex;

class GroupedData {
  constructor(keyField) {
    this.data = {};
    this.mutex = new Mutex();
    this.keyField = keyField;
  }

  async addItem(item) {
    const release = await this.mutex.acquire();
    try {
      const category = item[this.keyField];
      if (!this.data[category]) {
        this.data[category] = [];
      }
      this.data[category].push(item);
    } finally {
      release();
    }
  }

  async getItemsByCategory(category) {
    const release = await this.mutex.acquire();
    try {
      return this.data[category] || [];
    } finally {
      release();
    }
  }

  async getAllItems() {
    const release = await this.mutex.acquire();
    try {
      Object.values(this.data).flat();
    } finally {
      release();
    }
  }

  async updateItem(itemId, updates) {
    const release = await this.mutex.acquire();
    try {
      for (const category in this.data) {
        const items = this.data[category];
        const itemIndex = items.findIndex((item) => item.id === itemId);
        if (itemIndex !== -1) {
          this.data[category][itemIndex] = {
            ...items[itemIndex],
            ...updates,
          };
          return;
        }
      }
    } finally {
      release();
    }
  }

  async deleteItem(itemId) {
    const release = await this.mutex.acquire();
    try {
      for (const category in this.data) {
        const items = this.data[category];
        const itemIndex = items.findIndex((item) => item.id === itemId);
        if (itemIndex !== -1) {
          items.splice(itemIndex, 1);
          if (items.lenght === 0) {
            delete this.data[category];
          }
          return;
        }
      }
    } finally {
      release();
    }
  }

  async getCategories() {
    const release = await this.mutex.acquire();
    try {
      return Object.keys(this.data);
    } finally {
      release();
    }
  }
}

module.exports = GroupedData;
