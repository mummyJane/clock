# Clock Modules

This folder contains runtime modules for the bedside clock.

## Layout

- `api.py` defines the host API that modules register against.
- `clock/` is the built-in bedside clock module.

Each module should keep its own code, assets, and notes inside its own folder so the setup web interface and the bedside runtime can evolve around the same module identifiers.

## Host API

The Task 5 host scaffold currently supports:

- reading the current time
- reading the current date
- storing alarm requests
- registering config items
- registering draw items
- registering a screen press handler

The current API is intentionally standard-library only and acts as the shared contract for later bedside runtime tasks.
