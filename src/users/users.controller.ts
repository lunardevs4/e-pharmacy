import { Controller, Get, Put, Body, UseGuards, Req, Delete, Query } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery, ApiBody, ApiParam } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles } from '../common/guards/roles.decorator';
import { UpdateUserDto } from './dto/users.dto';
import { UserRole } from '@generated/prisma';

@ApiTags('Users')
@Controller('api/v1/users')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class UsersController {
  constructor(private usersService: UsersService) { }

  @Get('profile')
  @ApiOperation({
    summary: 'Get current user profile',
    description: 'Endpoint: GET /api/v1/users/profile\n\nReturns the profile of the currently authenticated user.',
  })
  getProfile(@Req() req: any) {
    return this.usersService.getProfile(req.user.id);
  }

  @Put('profile')
  @ApiOperation({
    summary: 'Update current user profile',
    description: 'Endpoint: PUT /api/v1/users/profile',
  })
  @ApiBody({
    type: UpdateUserDto,
    examples: {
      updateName: {
        value: {
          firstName: 'Jonathan',
          lastName: 'Doe',
        },
      },
      updatePhone: {
        value: {
          phone: '+2348099998888',
        },
      },
      fullUpdate: {
        value: {
          firstName: 'Jonathan',
          lastName: 'Smith',
          phone: '+2348099998888',
        },
      },
    },
  })
  updateProfile(@Req() req: any, @Body() updateUserDto: UpdateUserDto) {
    return this.usersService.updateProfile(req.user.id, updateUserDto);
  }

  @Delete('profile')
  @ApiOperation({
    summary: 'Soft delete current user',
    description: 'Endpoint: DELETE /api/v1/users/profile\n\nSoft deletes the currently authenticated user account.',
  })
  softDelete(@Req() req: any) {
    return this.usersService.softDelete(req.user.id);
  }

  @Get()
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: 'List all users (admin only)',
    description: 'Endpoint: GET /api/v1/users?page=1&limit=10\n\nQuery Parameters:\n- page (optional): Page number for pagination\n- limit (optional): Items per page',
  })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 10 })
  findAll(@Query('page') page?: number, @Query('limit') limit?: number) {
    return this.usersService.findAll(page, limit);
  }
}
