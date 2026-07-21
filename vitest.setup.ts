// Global test setup: load environment variables so the test database helper
// and email config can read DATABASE_URL / TEST_DATABASE_URL / EMAIL_* just
// like the running application does (see prisma.config.ts which also uses
// "dotenv/config").
import "dotenv/config";
