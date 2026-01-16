# Indexa

A small TypeScript-friendly wrapper around the browser `IndexedDB` API that provides typed stores, simple CRUD operations, and a subscription helper for reactive updates.

**Highlights**
- **Typed**: Use TypeScript generics to define your DB schema.
- **Simple API**: `add`, `get`, `getAll`, `update`, `delete`, `clear`, and `subscribe`.
- **Browser-focused**: Uses the global `indexedDB` (intended for browser environments).

**Status**: Experimental — use with care in production and consider tests/polyfills for non-browser runtimes.

**Author**: UndeffinedDev

---

**Installation & Setup**

- Install:

```bash
pnpm install @undeffineddev/indexa
```
---

### **Quick Usage**
Import the class
```ts
import { Indexa } from "./indexa";
```

Define a TypeScript schema and create a DB instance:
```ts
interface User {
    id: number;
    name: string;
    email: string;
}

type Schema = {
    users: User;
};

const db = new Indexa<Schema>("LocalDB", 1, {
    users: { keyPath: "id", autoIncrement: true },
});
```

#### `add()`
Add a new user to the `users` store:
```ts
await db.add("users", { id: 1, name: "Alice", email: "alice@example.com" });
```

#### `get()`
Retrieve a user by their key:
```ts
const user = await db.get("users", 1);
```

#### `getAll()`
Fetch all users from the store:
```ts
const allUsers = await db.getAll("users");
```

#### `update()`
Update an existing user:
```ts
await db.update("users", { id: 1, name: "Alice Smith", email: "alice@example.com" });
```

#### `delete()`
Remove a user by key:
```ts
await db.delete("users", 1);
```

#### `clear()`
Remove all users from the store:
```ts
await db.clear("users");
```

#### `subscribe()`
Reactively listen for changes in the users store:
```ts
db.subscribe("users", (users) => {
  console.log("Users updated:", users);
});
```

#### `unsubscribe()`
Stop listening for changes in the users store:
```ts
const callback = (users: User[]) => {};
db.subscribe("users", callback);
db.unsubscribe("users", callback);
```

#### `getByIndex()`
Fetch users by a secondary index (if you have an index defined):
```ts
await db.getByIndex("users", "email", "alice@example.com");
```

#### `count()`
Count the number of users in the store:
```ts
const count = await db.count("users");
```

#### `bulkAdd()`
Add multiple users in a single transaction:
```ts
await db.bulkAdd("users", [
    { id: 2, name: "Bob", email: "bob@example.com" },
    { id: 3, name: "Carol", email: "carol@example.com" },
]);
```

#### `bulkUpdate()`
Update multiple users in a single transaction:
```ts
await db.bulkUpdate("users", [
    { id: 2, name: "Bob Smith", email: "bob@example.com" },
    { id: 3, name: "Carol Jones", email: "carol@example.com" },
]);
```

#### `exists()`
Check if a user exists by key:
```ts
const exists = await db.exists("users", 2);
```

#### `iterate()`
Iterate over all users in the store:
```ts
await db.iterate("users", (user, key) => {
    console.log("User:", user, "Key:", key);
});
```

#### `close()`
Close the database connection:
```ts
await db.close();
```

#### `deleteDatabase()`
Delete the entire database:
```ts
await db.deleteDatabase();
```


**API (summary)**

- `new Indexa<TSchema>(name: string, version: number, stores: Record<string, StoreConfig>)` — Create/open a DB.
- `add(storeName, value)` — Insert a record. Returns the generated key.
- `get(storeName, key)` — Get a single record by key.
- `getAll(storeName)` — Get all records from a store.
- `update(storeName, value)` — Put/update a record.
- `delete(storeName, key)` — Delete a record by key.
- `clear(storeName)` — Clear all records from a store.
- `subscribe(storeName, callback)` — Subscribe to store changes; callback receives the current array of items.
- `unsubscribe(storeName, callback)` — Unsubscribe from store changes.
- `getByIndex(storeName, indexName, query)` — Get records by a secondary index.
- `count(storeName)` — Count records in a store.
- `bulkAdd(storeName, values)` — Add multiple records in a single transaction.
- `bulkUpdate(storeName, values)` — Update multiple records in a single transaction.
- `exists(storeName, key)` — Check if a key exists in a store.
- `iterate(storeName, callback)` — Iterate over all records in a store using a cursor.
- `close()` — Close the database connection.
- `deleteDatabase()` — Delete the entire database.
---

**Contributing**

Feel free to open issues or PRs.

**License**: MIT