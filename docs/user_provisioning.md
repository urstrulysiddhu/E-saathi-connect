# User Provisioning Guide

In production and testing (where self-sign up is disabled for security), users must be provisioned by a system administrator using the AWS CLI or AWS Console.

Because the system relies on Cognito JWT custom claims (`custom:role` and `custom:org`) for authorization, these claims must be carefully assigned by an administrator.

## Provisioning a User via AWS CLI

1. **Create the User**:

   ```bash
   aws cognito-idp admin-create-user \
     --user-pool-id <YOUR_USER_POOL_ID> \
     --username user@example.com \
     --user-attributes \
         Name=email,Value=user@example.com \
         Name=email_verified,Value=true \
         Name="custom:role",Value="CONSUMER" \
         Name="custom:org",Value=""
   ```

2. **Set a Permanent Password** (if required):
   ```bash
   aws cognito-idp admin-set-user-password \
     --user-pool-id <YOUR_USER_POOL_ID> \
     --username user@example.com \
     --password "SecurePassword123!" \
     --permanent
   ```

## Supported Roles

When setting the `custom:role` attribute, it must be exactly one of the following:

- `CONSUMER`
- `COLLECTOR`
- `HUB`
- `DESTINATION`
- `ADMIN`

## Organizations

For non-consumer roles, an organization ID can be supplied in `custom:org` to scope the user's data access.

Example for a Destination worker:

```bash
  --user-attributes Name="custom:role",Value="DESTINATION" Name="custom:org",Value="org-dest-1"
```
