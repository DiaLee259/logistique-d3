import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

export interface UserPrivileges {
  modules: {
    dashboard:   'NONE' | 'LECTURE' | 'EDITEUR' | 'ADMIN';
    commandes:   'NONE' | 'LECTURE' | 'EDITEUR' | 'ADMIN';
    commandesTS: 'NONE' | 'LECTURE' | 'EDITEUR' | 'ADMIN';
    livraisons:  'NONE' | 'LECTURE' | 'EDITEUR' | 'ADMIN';
    inventaire:  'NONE' | 'LECTURE' | 'EDITEUR' | 'ADMIN';
    mouvements:  'NONE' | 'LECTURE' | 'EDITEUR' | 'ADMIN';
    parametres:  'NONE' | 'LECTURE' | 'EDITEUR' | 'ADMIN';
    guide:       'NONE' | 'LECTURE' | 'EDITEUR' | 'ADMIN';
  };
  entrepots: string[];   // [] = tous visibles, sinon liste d'IDs
  actions: {
    importExcel:      boolean;
    exportExcel:      boolean;
    creerArticle:     boolean;
    supprimerRecord:  boolean;
    gererUtilisateurs: boolean;
  };
}

export const DEFAULT_PRIVILEGES: UserPrivileges = {
  modules: {
    dashboard: 'LECTURE', commandes: 'EDITEUR', commandesTS: 'LECTURE',
    livraisons: 'LECTURE', inventaire: 'LECTURE', mouvements: 'LECTURE',
    parametres: 'NONE', guide: 'LECTURE',
  },
  entrepots: [],
  actions: {
    importExcel: true, exportExcel: true, creerArticle: false,
    supprimerRecord: false, gererUtilisateurs: false,
  },
};

const SELECT_USER = {
  id: true, email: true, nom: true, prenom: true,
  role: true, actif: true, createdAt: true, privileges: true,
} as const;

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    return this.prisma.user.findMany({
      select: SELECT_USER,
      orderBy: { nom: 'asc' },
    });
  }

  /** Export admin uniquement — inclut le hash bcrypt du mot de passe */
  async findAllWithPassword() {
    return this.prisma.user.findMany({
      select: { ...SELECT_USER, password: true },
      orderBy: { nom: 'asc' },
    });
  }

  async findById(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id }, select: SELECT_USER });
    if (!user) throw new NotFoundException('Utilisateur introuvable');
    return user;
  }

  async findByEmail(email: string) {
    return this.prisma.user.findUnique({ where: { email } });
  }

  async create(dto: CreateUserDto) {
    const exists = await this.findByEmail(dto.email);
    if (exists) throw new ConflictException('Email déjà utilisé');
    const hashed = await bcrypt.hash(dto.password, 10);
    return this.prisma.user.create({
      data: { ...dto, password: hashed },
      select: SELECT_USER,
    });
  }

  async update(id: string, dto: UpdateUserDto) {
    await this.findById(id);
    const data: any = { ...dto };
    if (dto.password) data.password = await bcrypt.hash(dto.password, 10);
    return this.prisma.user.update({ where: { id }, data, select: SELECT_USER });
  }

  async updatePrivileges(id: string, privileges: UserPrivileges) {
    await this.findById(id);
    return this.prisma.user.update({
      where: { id },
      data: { privileges: privileges as any } as any,
      select: SELECT_USER,
    });
  }

  async toggleActif(id: string) {
    const user = await this.findById(id);
    return this.prisma.user.update({
      where: { id },
      data: { actif: !user.actif },
      select: SELECT_USER,
    });
  }
}
