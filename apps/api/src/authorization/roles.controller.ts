import { Body, Controller, HttpCode, HttpStatus, Post, Req, ParseUUIDPipe, Param } from '@nestjs/common';
import { IsInt, Max, Min } from 'class-validator';
import { AuthenticatedRequest } from '../auth/auth-context';
import { RequirePermissions } from './decorators/require-permissions.decorator';
import { RolesService } from './roles.service';
class ListUsersDto { @IsInt() @Min(1) @Max(50) take = 50; }
@Controller('authorization/users')
@RequirePermissions('admin:roles:manage')
export class RolesController {
  constructor(private readonly roles: RolesService) {}
  @Post('list') @HttpCode(HttpStatus.OK)
  list(@Body() body: ListUsersDto) { return this.roles.listUsers(body.take); }
  @Post(':userId/operator/assign') @HttpCode(HttpStatus.OK)
  assign(@Param('userId', new ParseUUIDPipe({ version: '4' })) userId: string, @Req() req: AuthenticatedRequest) {
    return this.roles.assignOperator(req.auth!.userId, userId, this.context(req));
  }
  @Post(':userId/operator/remove') @HttpCode(HttpStatus.OK)
  remove(@Param('userId', new ParseUUIDPipe({ version: '4' })) userId: string, @Req() req: AuthenticatedRequest) { return this.roles.removeOperator(req.auth!.userId, userId, this.context(req)); }
  private context(req: AuthenticatedRequest) { return { ipAddress: req.ip, device: req.get('user-agent')?.slice(0, 512) }; }
}
