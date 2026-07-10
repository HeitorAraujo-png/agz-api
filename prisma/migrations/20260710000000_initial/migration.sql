CREATE TABLE
    `Member` (
        `id` CHAR(36) NOT NULL,
        `memberId` VARCHAR(10) NOT NULL,
        `username` VARCHAR(80) NOT NULL,
        `email` VARCHAR(255) NOT NULL,
        `phone` VARCHAR(15) NULL,
        `passwordHash` VARCHAR(255) NOT NULL,
        `level` ENUM (
            'USER',
            'ORGANIZER',
            'ADMIN',
            'PRESIDENT',
            'SUPER_ADMIN'
        ) NOT NULL DEFAULT 'USER',
        `active` BOOLEAN NOT NULL DEFAULT true,
        `mustChangePassword` BOOLEAN NOT NULL DEFAULT true,
        `createdAt` DATETIME (3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        `updatedAt` DATETIME (3) NOT NULL,
        UNIQUE INDEX `Member_memberId_key` (`memberId`),
        UNIQUE INDEX `Member_username_key` (`username`),
        UNIQUE INDEX `Member_email_key` (`email`),
        PRIMARY KEY (`id`)
    ) DEFAULT CHARACTER
SET
    utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE
    `Dependent` (
        `id` INTEGER NOT NULL AUTO_INCREMENT,
        `memberId` CHAR(36) NOT NULL,
        `name` VARCHAR(255) NOT NULL,
        `active` BOOLEAN NOT NULL DEFAULT true,
        `createdAt` DATETIME (3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        PRIMARY KEY (`id`)
    ) DEFAULT CHARACTER
SET
    utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE
    `Reservation` (
        `id` CHAR(36) NOT NULL,
        `memberId` CHAR(36) NOT NULL,
        `date` DATE NOT NULL,
        `kioskNumber` INTEGER NOT NULL,
        `createdAt` DATETIME (3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        UNIQUE INDEX `Reservation_memberId_date_key` (`memberId`, `date`),
        UNIQUE INDEX `Reservation_date_kioskNumber_key` (`date`, `kioskNumber`),
        INDEX `Reservation_date_idx` (`date`),
        PRIMARY KEY (`id`)
    ) DEFAULT CHARACTER
SET
    utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE
    `ReservationDependent` (
        `reservationId` CHAR(36) NOT NULL,
        `dependentId` INTEGER NOT NULL,
        PRIMARY KEY (`reservationId`, `dependentId`)
    ) DEFAULT CHARACTER
SET
    utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE
    `Event` (
        `id` CHAR(36) NOT NULL,
        `name` VARCHAR(70) NOT NULL,
        `date` DATE NOT NULL,
        `active` BOOLEAN NOT NULL DEFAULT true,
        `createdAt` DATETIME (3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        UNIQUE INDEX `Event_date_key` (`date`),
        PRIMARY KEY (`id`)
    ) DEFAULT CHARACTER
SET
    utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE
    `Rental` (
        `id` CHAR(36) NOT NULL,
        `name` VARCHAR(150) NOT NULL,
        `startDate` DATE NOT NULL,
        `eventDate` DATE NOT NULL,
        `endDate` DATE NOT NULL,
        `active` BOOLEAN NOT NULL DEFAULT true,
        `createdAt` DATETIME (3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        INDEX `Rental_startDate_eventDate_endDate_idx` (`startDate`, `eventDate`, `endDate`),
        PRIMARY KEY (`id`)
    ) DEFAULT CHARACTER
SET
    utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE
    `RefreshToken` (
        `id` CHAR(36) NOT NULL,
        `memberId` CHAR(36) NOT NULL,
        `tokenHash` CHAR(64) NOT NULL,
        `expiresAt` DATETIME (3) NOT NULL,
        `revokedAt` DATETIME (3) NULL,
        `createdAt` DATETIME (3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        UNIQUE INDEX `RefreshToken_tokenHash_key` (`tokenHash`),
        PRIMARY KEY (`id`)
    ) DEFAULT CHARACTER
SET
    utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE
    `PasswordResetToken` (
        `id` CHAR(36) NOT NULL,
        `memberId` CHAR(36) NOT NULL,
        `tokenHash` CHAR(64) NOT NULL,
        `expiresAt` DATETIME (3) NOT NULL,
        `usedAt` DATETIME (3) NULL,
        `createdAt` DATETIME (3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        UNIQUE INDEX `PasswordResetToken_tokenHash_key` (`tokenHash`),
        PRIMARY KEY (`id`)
    ) DEFAULT CHARACTER
SET
    utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `Dependent` ADD CONSTRAINT `Dependent_memberId_fkey` FOREIGN KEY (`memberId`) REFERENCES `Member` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `Reservation` ADD CONSTRAINT `Reservation_memberId_fkey` FOREIGN KEY (`memberId`) REFERENCES `Member` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `ReservationDependent` ADD CONSTRAINT `ReservationDependent_reservationId_fkey` FOREIGN KEY (`reservationId`) REFERENCES `Reservation` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `ReservationDependent` ADD CONSTRAINT `ReservationDependent_dependentId_fkey` FOREIGN KEY (`dependentId`) REFERENCES `Dependent` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `RefreshToken` ADD CONSTRAINT `RefreshToken_memberId_fkey` FOREIGN KEY (`memberId`) REFERENCES `Member` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `PasswordResetToken` ADD CONSTRAINT `PasswordResetToken_memberId_fkey` FOREIGN KEY (`memberId`) REFERENCES `Member` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;