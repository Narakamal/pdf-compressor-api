import { Injectable } from '@nestjs/common';
import { CreatePdfDto } from './dto/create-pdf.dto';
import { UpdatePdfDto } from './dto/update-pdf.dto';

@Injectable()
export class PdfService {
  create(createPdfDto: CreatePdfDto) {
    return 'This action adds a new pdf';
  }

  findAll() {
    return `This action returns all pdf`;
  }

  findOne(id: number) {
    return `This action returns a #${id} pdf`;
  }

  update(id: number, updatePdfDto: UpdatePdfDto) {
    return `This action updates a #${id} pdf`;
  }

  remove(id: number) {
    return `This action removes a #${id} pdf`;
  }
}
