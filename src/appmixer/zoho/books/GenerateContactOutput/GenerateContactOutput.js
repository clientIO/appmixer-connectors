'use strict';

/**
 * @extends {Component}
 */
module.exports = {

    async receive(context) {

        // Common for GetContact, CreateContact and UpdateContact.
        // Also doesn't eat up the rate limit.
        return this.getOutputPortOptions(context);
    },

    getOutputPortOptions(context) {

        return context.sendJson(
            [
                { label: "Contact ID", value: "contact_id" },
                { label: "Contact Name", value: "contact_name" },
                { label: "Company Name", value: "company_name" },
                { label: "Has Transaction", value: "has_transaction" },
                { label: "Contact Type", value: "contact_type" },
                { label: "Customer Sub Type", value: "customer_sub_type" },
                { label: "Credit Limit", value: "credit_limit" },
                { label: "Is Portal Enabled", value: "is_portal_enabled" },
                { label: "Language Code", value: "language_code" },
                { label: "Is Taxable", value: "is_taxable" },
                { label: "Tax ID", value: "tax_id" },
                { label: "TDS Tax ID", value: "tds_tax_id" },
                { label: "Tax Name", value: "tax_name" },
                { label: "Tax Percentage", value: "tax_percentage" },
                { label: "Tax Authority ID", value: "tax_authority_id" },
                { label: "Tax Exemption ID", value: "tax_exemption_id" },
                { label: "Tax Authority Name", value: "tax_authority_name" },
                { label: "Tax Exemption Code", value: "tax_exemption_code" },
                { label: "Place of Contact", value: "place_of_contact" },
                { label: "GST Number", value: "gst_no" },
                { label: "VAT Treatment", value: "vat_treatment" },
                { label: "Tax Treatment", value: "tax_treatment" },
                { label: "Tax Regime", value: "tax_regime" },
                { label: "Is TDS Registered", value: "is_tds_registered" },
                { label: "GST Treatment", value: "gst_treatment" },
                { label: "Is Linked with Zoho CRM", value: "is_linked_with_zohocrm" },
                { label: "Website", value: "website" },
                { label: "Owner ID", value: "owner_id" },
                { label: "Primary Contact ID", value: "primary_contact_id" },
                { label: "Payment Terms", value: "payment_terms" },
                { label: "Payment Terms Label", value: "payment_terms_label" },
                { label: "Currency ID", value: "currency_id" },
                { label: "Currency Code", value: "currency_code" },
                { label: "Currency Symbol", value: "currency_symbol" },
                { label: "Opening Balance Amount", value: "opening_balance_amount" },
                { label: "Exchange Rate", value: "exchange_rate" },
                { label: "Outstanding Receivable Amount", value: "outstanding_receivable_amount" },
                { label: "Outstanding Receivable Amount BCY", value: "outstanding_receivable_amount_bcy" },
                { label: "Unused Credits Receivable Amount", value: "unused_credits_receivable_amount" },
                { label: "Unused Credits Receivable Amount BCY", value: "unused_credits_receivable_amount_bcy" },
                { label: "Status", value: "status" },
                { label: "Payment Reminder Enabled", value: "payment_reminder_enabled" },
                {
                    label: "Custom fields", value: "custom_fields", schema: {
                        type: "array",
                        items: {
                            type: "object",
                            properties: {
                                index: { type: "number", title: "Index" },
                                value: { type: "any", title: "Value" },
                                label: { type: "string", title: "Label" }
                            }
                        }
                    }
                },
                {
                    label: "Billing Address", value: "billing_address", schema: {
                        type: "object",
                        properties: {
                            attention: { type: "string", title: "Billing Address - Attention" },
                            address: { type: "string", title: "Billing Address - Address" },
                            street2: { type: "string", title: "Billing Address - Street 2" },
                            state_code: { type: "string", title: "Billing Address - State Code" },
                            city: { type: "string", title: "Billing Address - City" },
                            state: { type: "string", title: "Billing Address - State" },
                            zip: { type: "string", title: "Billing Address - ZIP" },
                            country: { type: "string", title: "Billing Address - Country" },
                            fax: { type: "string", title: "Billing Address - Fax" },
                            phone: { type: "string", title: "Billing Address - Phone" }
                        }
                    }
                },
                {
                    label: "Shipping Address", value: "shipping_address", schema: {
                        type: "object",
                        properties: {
                            attention: { type: "string", title: "Shipping Address - Attention" },
                            address: { type: "string", title: "Shipping Address - Address" },
                            street2: { type: "string", title: "Shipping Address - Street 2" },
                            state_code: { type: "string", title: "Shipping Address - State Code" },
                            city: { type: "string", title: "Shipping Address - City" },
                            state: { type: "string", title: "Shipping Address - State" },
                            zip: { type: "string", title: "Shipping Address - ZIP" },
                            country: { type: "string", title: "Shipping Address - Country" },
                            fax: { type: "string", title: "Shipping Address - Fax" },
                            phone: { type: "string", title: "Shipping Address - Phone" }
                        }
                    }
                },
                { label: "Facebook", value: "facebook" },
                { label: "Twitter", value: "twitter" },
                {
                    label: "Contact Persons", value: "contact_persons", schema: {
                        type: "array",
                        items: {
                            type: "object",
                            properties: {
                                contact_person_id: { type: "string", title: "Contact Person ID" },
                                salutation: { type: "string", title: "Salutation" },
                                first_name: { type: "string", title: "First Name" },
                                last_name: { type: "string", title: "Last Name" },
                                email: { type: "string", title: "Email" },
                                phone: { type: "string", title: "Phone" },
                                mobile: { type: "string", title: "Mobile" },
                                designation: { type: "string", title: "Designation" },
                                department: { type: "string", title: "Department" },
                                skype: { type: "string", title: "Skype" },
                                is_primary_contact: { type: "boolean", title: "Is Primary Contact" },
                                enable_portal: { type: "boolean", title: "Enable Portal" }
                            }
                        }
                    }
                },
                {
                    label: "Default Templates", value: "default_templates", schema: {
                        type: "object",
                        properties: {
                            invoice_template_id: { type: "string", title: "Invoice Template ID" },
                            estimate_template_id: { type: "string", title: "Estimate Template ID" },
                            creditnote_template_id: { type: "string", title: "Creditnote Template ID" },
                            purchaseorder_template_id: { type: "string", title: "Purchaseorder Template ID" },
                            salesorder_template_id: { type: "string", title: "Salesorder Template ID" },
                            retainerinvoice_template_id: { type: "string", title: "Retainerinvoice Template ID" },
                            paymentthankyou_template_id: { type: "string", title: "Paymentthankyou Template ID" },
                            retainerinvoice_paymentthankyou_template_id: { type: "string", title: "Retainerinvoice Paymentthankyou Template ID" },
                            invoice_email_template_id: { type: "string", title: "Invoice Email Template ID" },
                            estimate_email_template_id: { type: "string", title: "Estimate Email Template ID" },
                            creditnote_email_template_id: { type: "string", title: "Creditnote Email Template ID" },
                            purchaseorder_email_template_id: { type: "string", title: "Purchaseorder Email Template ID" },
                            salesorder_email_template_id: { type: "string", title: "Salesorder Email Template ID" },
                            retainerinvoice_email_template_id: { type: "string", title: "Retainerinvoice Email Template ID" },
                            paymentthankyou_email_template_id: { type: "string", title: "Paymentthankyou Email Template ID" },
                            retainerinvoice_paymentthankyou_email_template_id: { type: "string", title: "Retainerinvoice Paymentthankyou Email Template ID" }
                        }
                    }
                },
                { label: "Notes", value: "notes" },
                { label: "Created Time", value: "created_time" },
                { label: "Last Modified Time", value: "last_modified_time" }
            ],
            'out'
        );
    }
};
