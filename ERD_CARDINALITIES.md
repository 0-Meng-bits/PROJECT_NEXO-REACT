# ERD Cardinalities Guide

## 📊 USER_PROFILE_SETTINGS Table

### Foreign Keys and Cardinalities:

```
user_profile_settings
├── user_id (PK, FK → accounts.id)
│   └── Cardinality: 1:1 (One-to-One)
│       • Each user has ONE profile settings record
│       • Each profile settings belongs to ONE user
│       • ON DELETE CASCADE (if user deleted, settings deleted)
│
├── active_theme (FK → shop_items.id)
│   └── Cardinality: N:1 (Many-to-One)
│       • Many users can have the SAME theme active
│       • Each user can have only ONE active theme at a time
│       • Optional (can be NULL)
│
├── active_badge (FK → shop_items.id)
│   └── Cardinality: N:1 (Many-to-One)
│       • Many users can have the SAME badge active
│       • Each user can have only ONE active badge at a time
│       • Optional (can be NULL)
│
├── active_background (FK → shop_items.id)
│   └── Cardinality: N:1 (Many-to-One)
│       • Many users can have the SAME background active
│       • Each user can have only ONE active background at a time
│       • Optional (can be NULL)
│
├── active_name_color (FK → shop_items.id)
│   └── Cardinality: N:1 (Many-to-One)
│       • Many users can have the SAME name color active
│       • Each user can have only ONE active name color at a time
│       • Optional (can be NULL)
│
└── active_music (FK → shop_items.id)
    └── Cardinality: N:1 (Many-to-One)
        • Many users can have the SAME music active
        • Each user can have only ONE active music at a time
        • Optional (can be NULL)
```

---

## 📋 TASK_ITEMS Table

### Foreign Keys and Cardinalities:

```
task_items
├── channel_id (FK → channels.id)
│   └── Cardinality: N:1 (Many-to-One)
│       • Many tasks belong to ONE channel
│       • Each channel can have MANY tasks
│       • ON DELETE CASCADE (if channel deleted, tasks deleted)
│
├── assigned_to (FK → accounts.id)
│   └── Cardinality: N:1 (Many-to-One)
│       • Many tasks can be assigned to ONE user
│       • Each user can have MANY tasks assigned
│       • ON DELETE SET NULL (if user deleted, task remains but unassigned)
│       • Optional (can be NULL - unassigned task)
│
└── created_by (FK → accounts.id)
    └── Cardinality: N:1 (Many-to-One)
        • Many tasks created by ONE user
        • Each user can create MANY tasks
        • Optional (can be NULL)
```

---

## 🛍️ SHOP_ITEMS Table (For Context)

### Reverse Relationships:

```
shop_items
├── → user_profile_settings.active_theme
│   └── Cardinality: 1:N (One-to-Many)
│       • One shop item can be the active theme for MANY users
│
├── → user_profile_settings.active_badge
│   └── Cardinality: 1:N (One-to-Many)
│       • One shop item can be the active badge for MANY users
│
├── → user_profile_settings.active_background
│   └── Cardinality: 1:N (One-to-Many)
│       • One shop item can be the active background for MANY users
│
├── → user_profile_settings.active_name_color
│   └── Cardinality: 1:N (One-to-Many)
│       • One shop item can be the active name color for MANY users
│
├── → user_profile_settings.active_music
│   └── Cardinality: 1:N (One-to-Many)
│       • One shop item can be the active music for MANY users
│
└── → user_purchases.item_id
    └── Cardinality: 1:N (One-to-Many)
        • One shop item can be purchased by MANY users
```

---

## 📝 ERD Notation Cheat Sheet

### How to Draw These in Your ERD:

#### **ONE-TO-ONE (1:1)** - accounts ↔ user_profile_settings
```
[accounts] ──────── [user_profile_settings]
     1                        1
     │                        │
   (user_id)              (user_id PK,FK)
```
**Representation**: Single line with "1" on both sides


#### **MANY-TO-ONE (N:1)** - user_profile_settings → shop_items
```
[user_profile_settings] ──────>──── [shop_items]
           N                            1
           │                            │
   (active_theme FK)                 (id PK)
```
**Representation**: Crow's foot (many) on settings side, single line on shop_items side


#### **MANY-TO-ONE (N:1)** - task_items → channels
```
[task_items] ──────>──── [channels]
      N                       1
      │                       │
 (channel_id FK)           (id PK)
```
**Representation**: Crow's foot on task_items side, single line on channels side


#### **MANY-TO-ONE (N:1)** - task_items → accounts (assigned_to)
```
[task_items] ──────>──── [accounts]
      N                       1
      │                       │
 (assigned_to FK)          (id PK)
```
**Representation**: Crow's foot on task_items side, single line on accounts side
*Note: This is OPTIONAL (dashed line in some notations)*


#### **MANY-TO-ONE (N:1)** - task_items → accounts (created_by)
```
[task_items] ──────>──── [accounts]
      N                       1
      │                       │
 (created_by FK)           (id PK)
```
**Representation**: Crow's foot on task_items side, single line on accounts side


---

## 🎯 Quick Reference Table

| Relationship | From Table | To Table | Cardinality | Type | Optional? |
|-------------|-----------|----------|-------------|------|-----------|
| **User Settings** | user_profile_settings | accounts | N:1 | Identifying | No (PK) |
| **Active Theme** | user_profile_settings | shop_items | N:1 | Non-identifying | Yes (NULL) |
| **Active Badge** | user_profile_settings | shop_items | N:1 | Non-identifying | Yes (NULL) |
| **Active Background** | user_profile_settings | shop_items | N:1 | Non-identifying | Yes (NULL) |
| **Active Name Color** | user_profile_settings | shop_items | N:1 | Non-identifying | Yes (NULL) |
| **Active Music** | user_profile_settings | shop_items | N:1 | Non-identifying | Yes (NULL) |
| **Task Channel** | task_items | channels | N:1 | Non-identifying | No |
| **Task Assignee** | task_items | accounts | N:1 | Non-identifying | Yes (NULL) |
| **Task Creator** | task_items | accounts | N:1 | Non-identifying | Yes (NULL) |

---

## 💡 Key Points for Your ERD:

1. **user_profile_settings → accounts**: This is **1:1** because user_id is the PRIMARY KEY
2. **All active_* fields → shop_items**: These are **N:1** (many users can use the same item)
3. **task_items → channels**: **N:1** (many tasks in one channel)
4. **task_items → accounts (assigned_to)**: **N:1** (many tasks assigned to one user)
5. **task_items → accounts (created_by)**: **N:1** (many tasks created by one user)

### Crow's Foot Notation:
- **One**: `──────` (single line)
- **Many**: `──<──` (crow's foot / fork)
- **Optional**: `○────` (circle on the line)
- **Mandatory**: `|────` (perpendicular line)

### Example in Crow's Foot:
```
[user_profile_settings] }○──── [shop_items]
    (active_theme)               (id)

Legend:
}  = Many (crow's foot)
○  = Optional (circle)
── = Relationship line
```

This means: "Many user_profile_settings can optionally reference one shop_items"

---

**Summary**: All your shop item references are **Many-to-One (N:1)** relationships, and the user_id is a **One-to-One (1:1)** relationship. Task items have **Many-to-One (N:1)** relationships with both channels and accounts.
