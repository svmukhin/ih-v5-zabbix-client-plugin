const Mutex = require('async-mutex').Mutex;

class ConcurrentList {
    constructor() {
        this.list = [];
        this.mutex = new Mutex();
    }

    async add(item) {
        const release = await this.mutex.acquire();
        try {
            this.list.push(item);
        } finally {
            release();
        }
    }

    async remove(item) {
        const release = await this.mutex.acquire();
        try {
            const index = this.list.indexOf(item);
            if (index > -1) {
                this.list.splice(index, 1);
            }
        } finally {
            release();
        }
    }

    async getList() {
        const release = await this.mutex.acquire();
        try {
            return this.list;
        } finally {
            release();
        }
    }
}

module.exports = ConcurrentList;