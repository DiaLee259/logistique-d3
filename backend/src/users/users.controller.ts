import { Controller, Get, Post, Put, Patch, Body, Param, UseGuards, Res } from '@nestjs/common';
import { Response } from 'express';
import * as ExcelJS from 'exceljs';
import { UsersService, UserPrivileges } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UsersController {
  constructor(private usersService: UsersService) {}

  @Get()
  @Roles('ADMIN', 'CHEF_PROJET')
  findAll() {
    return this.usersService.findAll();
  }

  @Get('export')
  @Roles('ADMIN')
  async exportUsers(@Res() res: Response) {
    const users = await this.usersService.findAllWithPassword();

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Comptes utilisateurs');

    ws.columns = [
      { header: 'ID',          key: 'id',        width: 38 },
      { header: 'Prénom',      key: 'prenom',     width: 18 },
      { header: 'Nom',         key: 'nom',        width: 18 },
      { header: 'Email',       key: 'email',      width: 32 },
      { header: 'Rôle',        key: 'role',       width: 20 },
      { header: 'Actif',       key: 'actif',      width: 8  },
      { header: 'Créé le',     key: 'createdAt',  width: 20 },
      { header: 'Hash mot de passe (bcrypt)', key: 'password', width: 70 },
    ];

    ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1A3A6E' } };

    for (const u of users) {
      ws.addRow({
        id: u.id,
        prenom: u.prenom,
        nom: u.nom,
        email: u.email,
        role: u.role,
        actif: u.actif ? 'Oui' : 'Non',
        createdAt: new Date(u.createdAt).toLocaleString('fr-FR'),
        password: u.password,
      });
    }

    // Note en bas
    const noteRow = ws.addRow([]);
    noteRow.getCell(1).value = '⚠️ Les mots de passe sont des hachages bcrypt (irréversibles). Ce fichier est confidentiel.';
    noteRow.getCell(1).font = { italic: true, color: { argb: 'FF888888' } };
    ws.mergeCells(`A${noteRow.number}:H${noteRow.number}`);

    const buffer = await wb.xlsx.writeBuffer();
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="export-comptes-${new Date().toISOString().slice(0,10)}.xlsx"`);
    res.send(buffer);
  }

  @Get(':id')
  findById(@Param('id') id: string) {
    return this.usersService.findById(id);
  }

  @Post()
  @Roles('ADMIN')
  create(@Body() dto: CreateUserDto) {
    return this.usersService.create(dto);
  }

  @Put(':id')
  @Roles('ADMIN')
  update(@Param('id') id: string, @Body() dto: UpdateUserDto) {
    return this.usersService.update(id, dto);
  }

  @Patch(':id/toggle-actif')
  @Roles('ADMIN')
  toggleActif(@Param('id') id: string) {
    return this.usersService.toggleActif(id);
  }

  @Put(':id/privileges')
  @Roles('ADMIN')
  updatePrivileges(@Param('id') id: string, @Body() privileges: UserPrivileges) {
    return this.usersService.updatePrivileges(id, privileges);
  }
}
