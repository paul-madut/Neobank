-- Throwaway accounts created by the one-click demo on the landing page.
--
-- Each visitor gets their own customer rather than sharing one demo login, so
-- a stranger can only ever affect their own copy. These two columns are what
-- lets cleanup find and remove them once they expire.

ALTER TABLE "User" ADD COLUMN     "demoExpiresAt" TIMESTAMP(3),
                  ADD COLUMN     "isDemo" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "User_isDemo_demoExpiresAt_idx" ON "User"("isDemo", "demoExpiresAt");
