# Makefile for Personal CMS Local Development

.PHONY: setup dev db-reset db-seed test clean

# Install dependencies
setup:
	@echo "Installing dependencies..."
	npm install

# Start development servers (frontend + backend)
dev:
	@echo "Starting development servers..."
	npm run dev:all

# Reset local database (drops .wrangler state and reapplies migrations)
db-reset:
	@echo "Resetting local database..."
	rm -rf .wrangler/state/v3/d1
	npx wrangler d1 migrations apply personal-cms-local --local

# Seed local database with initial data
db-seed:
	@echo "Seeding local database..."
	npx wrangler d1 execute personal-cms-local --local --file=seeds/seed_dev.sql

# Run tests
test:
	@echo "Running tests..."
	npm test

# Clean up build artifacts and temporary files
clean:
	@echo "Cleaning up..."
	rm -rf dist
	rm -rf .wrangler
	rm -rf node_modules
