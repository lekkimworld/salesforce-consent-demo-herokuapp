# Salesforce Consent Demo - Heroku App #
Heroku app part of the Salesforce Consent Demo.

## Environment variables ##
* `JWT_CLIENT_ID` (required, client ID from Connected App for JWT authentication ("id1_"))
* `JWT_PRIVATE_KEY` (required, private key in PEM format as generated from the "org" repo)
* `JWT_SUBJECT` (required, the username to impersonate when updating consent in Salesforce - should be the username of the scratch org user)
* `OIDC_CLIENT_ID` (required, client ID for OpenID Connect authentication ("id2_"))
* `OIDC_CLIENT_SECRET` (required, client secret for OpenID Connect authentication ("secret2_"))
* `OIDC_REDIRECT_URI` (required, redirection URI as specified in the Connected App for OpenID Connect authentication)
* `OIDC_SCOPES` (scopes used for OpenID Connect authentication - defaults to `openid email`)
* `OIDC_PROMPT` (`prompt` query string parameter for Salesforce - defaults to `login` to force reauthentication)
* `OIDC_PROVIDER_URL` (defaults to `login.salesforce.com`)
* `REDIS_TLS_URL` (Redis TLS URL for session storage - takes precedence over `REDIS_URL`)
* `REDIS_URL` (Redis URL for session storage)
* `REDIS_CONNECTION_TIMEOUT` (Redis connection timeout - defaults to 20 seconds)
* `API_VERSION` (defaults to `v51.0`)
* `PAGE_TITLE`(defaults to "My App")
* `SESSION_SECRET` (defaults to a UUID)
