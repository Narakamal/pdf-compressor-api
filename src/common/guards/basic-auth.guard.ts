import {
    CanActivate,
    ExecutionContext,
    Injectable,
    UnauthorizedException
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class BasicAuthGuard implements CanActivate {
    constructor(private config: ConfigService) { }

    canActivate(ctx: ExecutionContext): boolean {
        const req = ctx.switchToHttp().getRequest();
        const authHeader = req.headers['authorization'] ?? '';

        if (!authHeader.startsWith('Basic ')) throw new UnauthorizedException();

        const [user, pass] = Buffer.from(authHeader.slice(6), 'base64')
            .toString()
            .split(':');

        const validUser = this.config.get('app.basicAuthUser');
        const validPass = this.config.get('app.basicAuthPass');

        if (user !== validUser || pass !== validPass) throw new UnauthorizedException();
        return true;
    }
}