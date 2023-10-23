import { Response } from "express";
import { buildContext } from "./handlebars";

export default (res: Response, template: string, context: any = {}) => {
    // build context
    const ctx = Object.assign(buildContext(res.locals.user), context);
    if (ctx.user) delete ctx.user.userinfo;
    res.render(template, ctx);
};
