export declare const SystemRoles: {
    readonly SUPER_ADMIN: "SUPER_ADMIN";
    readonly OWNER: "OWNER";
    readonly MANAGER: "MANAGER";
    readonly PHARMACIST: "PHARMACIST";
    readonly ACCOUNTANT: "ACCOUNTANT";
};
export type SystemRole = (typeof SystemRoles)[keyof typeof SystemRoles];
export declare const NamedPermissions: {
    readonly STORE_READ: "store.read";
    readonly STORE_UPDATE: "store.update";
    readonly BILL_CREATE: "bill.create";
    readonly BILL_READ: "bill.read";
    readonly BILL_CANCEL: "bill.cancel";
    readonly BILL_REFUND: "bill.refund";
    readonly INVENTORY_READ: "inventory.read";
    readonly INVENTORY_WRITE: "inventory.write";
    readonly INVENTORY_ADJUST: "inventory.adjust";
    readonly IMPORT_EXECUTE: "import.execute";
    readonly PO_CREATE: "po.create";
    readonly PO_RECEIVE: "po.receive";
    readonly DOCTOR_READ: "doctor.read";
    readonly DOCTOR_WRITE: "doctor.write";
    readonly EMPLOYEE_READ: "employee.read";
    readonly EMPLOYEE_WRITE: "employee.write";
    readonly EXPENSE_READ: "expense.read";
    readonly EXPENSE_WRITE: "expense.write";
    readonly REPORT_FINANCIAL: "report.financial";
    readonly REPORT_GST: "report.gst";
    readonly AUDIT_READ: "audit.read";
    readonly SUPPLIER_READ: "supplier.read";
    readonly SUPPLIER_WRITE: "supplier.write";
};
export type NamedPermission = (typeof NamedPermissions)[keyof typeof NamedPermissions];
export declare const PERMISSION_ROLE_MAP: Record<NamedPermission, readonly SystemRole[]>;
//# sourceMappingURL=roles.d.ts.map