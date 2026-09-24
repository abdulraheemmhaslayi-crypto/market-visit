-- SQL Server / Azure SQL Schema Definition
-- Run this script in Azure Data Studio or SSMS to initialize your database

-- 1. Manager
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='Manager' and xtype='U')
CREATE TABLE [Manager] (
  [id] VARCHAR(191) PRIMARY KEY,
  [name] VARCHAR(191) UNIQUE NOT NULL
);
GO

-- 2. User
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='User' and xtype='U')
CREATE TABLE [User] (
  [id] VARCHAR(191) PRIMARY KEY,
  [name] VARCHAR(191) NOT NULL,
  [employeeCode] VARCHAR(191) UNIQUE NOT NULL,
  [email] VARCHAR(191) UNIQUE NOT NULL,
  [passwordHash] VARCHAR(191) NOT NULL,
  [mobile] VARCHAR(191) NOT NULL,
  [role] VARCHAR(50) NOT NULL,
  [status] VARCHAR(50) NOT NULL,
  [managerId] VARCHAR(191) NULL,
  [createdAt] DATETIME NOT NULL DEFAULT GETDATE()
);
GO

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name='idx_user_email' AND object_id = OBJECT_ID('User'))
CREATE INDEX [idx_user_email] ON [User] ([email]);
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name='idx_user_employee_code' AND object_id = OBJECT_ID('User'))
CREATE INDEX [idx_user_employee_code] ON [User] ([employeeCode]);
GO

-- 3. Route
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='Route' and xtype='U')
CREATE TABLE [Route] (
  [routeCode] VARCHAR(191) PRIMARY KEY,
  [routeName] VARCHAR(191) NOT NULL,
  [channel] VARCHAR(191) NOT NULL DEFAULT 'GT',
  [supervisorId] VARCHAR(191) NULL,
  [managerId] VARCHAR(191) NULL,
  [superName] VARCHAR(191) NULL
);
GO

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name='idx_route_supervisor' AND object_id = OBJECT_ID('Route'))
CREATE INDEX [idx_route_supervisor] ON [Route] ([supervisorId]);
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name='idx_route_manager' AND object_id = OBJECT_ID('Route'))
CREATE INDEX [idx_route_manager] ON [Route] ([managerId]);
GO

-- 4. Customer
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='Customer' and xtype='U')
CREATE TABLE [Customer] (
  [cust_rt_id] VARCHAR(191) PRIMARY KEY,
  [customerCode] VARCHAR(191) NOT NULL,
  [customerName] VARCHAR(191) NOT NULL,
  [classification] VARCHAR(50) NOT NULL,
  [dairyClassification] VARCHAR(50) NULL,
  [iceCreamClassification] VARCHAR(50) NULL,
  [channel] VARCHAR(191) NOT NULL,
  [routeCode] VARCHAR(191) NOT NULL,
  FOREIGN KEY ([routeCode]) REFERENCES [Route]([routeCode]) ON DELETE CASCADE
);
GO

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name='idx_customer_route' AND object_id = OBJECT_ID('Customer'))
CREATE INDEX [idx_customer_route] ON [Customer] ([routeCode]);
GO

-- 5. Customer_Classification
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='Customer_Classification' and xtype='U')
CREATE TABLE [Customer_Classification] (
  [id] INT IDENTITY(1,1) PRIMARY KEY,
  [customerCode] VARCHAR(191) NOT NULL,
  [businessVertical] VARCHAR(50) NOT NULL,
  [classification] VARCHAR(50) NOT NULL,
  [channel] VARCHAR(100) NULL,
  [updatedAt] DATETIME DEFAULT GETDATE(),
  CONSTRAINT uk_customer_vertical UNIQUE ([customerCode], [businessVertical])
);
GO

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name='idx_cust_class_code' AND object_id = OBJECT_ID('Customer_Classification'))
CREATE INDEX [idx_cust_class_code] ON [Customer_Classification] ([customerCode]);
GO

-- 6. SKU
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='SKU' and xtype='U')
CREATE TABLE [SKU] (
  [skuCode] VARCHAR(191) PRIMARY KEY,
  [skuName] VARCHAR(191) NOT NULL,
  [type] VARCHAR(50) NOT NULL DEFAULT 'SKU',
  [businessVertical] VARCHAR(191) NULL
);
GO

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name='idx_sku_type' AND object_id = OBJECT_ID('SKU'))
CREATE INDEX [idx_sku_type] ON [SKU] ([type]);
GO

-- 7. PowerSKU
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='PowerSKU' and xtype='U')
CREATE TABLE [PowerSKU] (
  [skuCode] VARCHAR(191) NOT NULL,
  [skuName] VARCHAR(191) NOT NULL,
  [channel] VARCHAR(191) NOT NULL,
  PRIMARY KEY ([skuCode], [channel])
);
GO

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name='idx_powersku_channel' AND object_id = OBJECT_ID('PowerSKU'))
CREATE INDEX [idx_powersku_channel] ON [PowerSKU] ([channel]);
GO

-- 8. Visit
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='Visit' and xtype='U')
CREATE TABLE [Visit] (
  [visitId] VARCHAR(191) PRIMARY KEY,
  [supervisorId] VARCHAR(191) NOT NULL,
  [cust_rt_id] VARCHAR(191) NOT NULL,
  [visit_type] VARCHAR(50) NOT NULL DEFAULT 'Visit',
  [reason_category] VARCHAR(191) NULL,
  [reason] TEXT NULL,
  [latitude] FLOAT NOT NULL,
  [longitude] FLOAT NOT NULL,
  [accuracy] FLOAT NOT NULL,
  [status] VARCHAR(50) NOT NULL,
  [createdBy] VARCHAR(191) NOT NULL,
  [visit_datetime] DATETIME NOT NULL,
  [createdAt] DATETIME NOT NULL DEFAULT GETDATE(),
  [updatedAt] DATETIME NOT NULL DEFAULT GETDATE(),
  [sosAsPerBda] TINYINT NULL,
  FOREIGN KEY ([cust_rt_id]) REFERENCES [Customer]([cust_rt_id]) ON DELETE CASCADE
);
GO

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name='idx_visit_supervisor' AND object_id = OBJECT_ID('Visit'))
CREATE INDEX [idx_visit_supervisor] ON [Visit] ([supervisorId]);
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name='idx_visit_cust_rt' AND object_id = OBJECT_ID('Visit'))
CREATE INDEX [idx_visit_cust_rt] ON [Visit] ([cust_rt_id]);
GO

-- 9. VisitPhoto
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='VisitPhoto' and xtype='U')
CREATE TABLE [VisitPhoto] (
  [photoId] VARCHAR(191) PRIMARY KEY,
  [visitId] VARCHAR(191) NOT NULL,
  [category] VARCHAR(50) NOT NULL,
  [cloudinaryUrl] TEXT NOT NULL,
  [publicId] VARCHAR(191) NOT NULL,
  [uploadedAt] DATETIME NOT NULL,
  [appName] VARCHAR(191) NULL DEFAULT 'Chrome',
  FOREIGN KEY ([visitId]) REFERENCES [Visit]([visitId]) ON DELETE CASCADE
);
GO

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name='idx_photo_visit' AND object_id = OBJECT_ID('VisitPhoto'))
CREATE INDEX [idx_photo_visit] ON [VisitPhoto] ([visitId]);
GO

-- 10. VisitAsset
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='VisitAsset' and xtype='U')
CREATE TABLE [VisitAsset] (
  [assetId] VARCHAR(191) PRIMARY KEY,
  [visitId] VARCHAR(191) NOT NULL,
  [assetType] VARCHAR(50) NOT NULL,
  [temperature] FLOAT NULL,
  [tempInRange] TINYINT NULL,
  [actionRequired] VARCHAR(50) NULL,
  [observation] TEXT NULL,
  [isFirstInFlow] TINYINT NULL DEFAULT 0,
  [fefoFollowed] TINYINT NULL DEFAULT 0
);
GO

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name='idx_asset_visit' AND object_id = OBJECT_ID('VisitAsset'))
CREATE INDEX [idx_asset_visit] ON [VisitAsset] ([visitId]);
GO

-- 11. VisitPowerSkuResult
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='VisitPowerSkuResult' and xtype='U')
CREATE TABLE [VisitPowerSkuResult] (
  [visitId] VARCHAR(191) NOT NULL,
  [skuCode] VARCHAR(191) NOT NULL,
  [status] VARCHAR(50) NOT NULL,
  PRIMARY KEY ([visitId], [skuCode])
);
GO

-- 12. NPDResponse
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='NPDResponse' and xtype='U')
CREATE TABLE [NPDResponse] (
  [visitId] VARCHAR(191) NOT NULL,
  [skuCode] VARCHAR(191) NOT NULL,
  [status] VARCHAR(50) NOT NULL,
  PRIMARY KEY ([visitId], [skuCode]),
  FOREIGN KEY ([visitId]) REFERENCES [Visit]([visitId]) ON DELETE CASCADE,
  FOREIGN KEY ([skuCode]) REFERENCES [SKU]([skuCode])
);
GO

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name='idx_npd_sku' AND object_id = OBJECT_ID('NPDResponse'))
CREATE INDEX [idx_npd_sku] ON [NPDResponse] ([skuCode]);
GO

-- 13. AuditLog
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='AuditLog' and xtype='U')
CREATE TABLE [AuditLog] (
  [logId] VARCHAR(191) PRIMARY KEY,
  [user] VARCHAR(191) NOT NULL,
  [action] VARCHAR(191) NOT NULL,
  [entity] VARCHAR(191) NOT NULL,
  [createdAt] DATETIME NOT NULL DEFAULT GETDATE()
);
GO
