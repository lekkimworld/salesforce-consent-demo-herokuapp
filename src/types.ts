export class HttpException extends Error {
    statusCode: number;
    message: string;
    error?: Error;
    type: string;

    constructor(
        statusCode: number,
        message: string,
        error?: Error,
        type: string = "json"
    ) {
        super(message);

        this.statusCode = statusCode;
        this.message = message;
        this.error = error;
        this.type = type;
    }
}

export class TermsData {
    lastUpdate: number;
    tos?: boolean;
    order?: boolean;
    newsletter?: boolean;

    constructor() {
        this.lastUpdate = Date.now();
    }
}

export class AuthenticatedUser {
    fn: string;
    ln: string;
    fullname: string;
    userId: string;
    contactId: string;
    active: boolean;
    photo: string;
    userinfo: any;
    terms?: TermsData;

    constructor(userinfo: any) {
        this.fn = userinfo.given_name;
        this.ln = userinfo.family_name;
        this.fullname = userinfo.name;
        this.userId = userinfo.user_id;
        this.contactId = userinfo.custom_attributes.contactId;
        this.active = userinfo.active;
        this.photo = userinfo.photos.picture;
        this.userinfo = userinfo;
    }
}

/**
 * Browser payload when browser is asking for a OpenID Connect Provider
 * login url.
 *
 */
export interface AuthenticationUrlPayload {
    url: string;
}

/**
 * Derivative of AuthenticationUrlPayload to extend with the nonce
 * used during the OpenID Connect authentication flow.
 */
export interface AuthenticationUrlWithNonce extends AuthenticationUrlPayload {
    nonce: string;
}