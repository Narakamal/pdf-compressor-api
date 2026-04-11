import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { PdfService } from './pdf.service';
import { CreatePdfDto } from './dto/create-pdf.dto';
import { UpdatePdfDto } from './dto/update-pdf.dto';

@Controller('pdf')
export class PdfController {
  constructor(private readonly pdfService: PdfService) {}

  @Post()
  create(@Body() createPdfDto: CreatePdfDto) {
    return this.pdfService.create(createPdfDto);
  }

  @Get()
  findAll() {
    return this.pdfService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.pdfService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updatePdfDto: UpdatePdfDto) {
    return this.pdfService.update(+id, updatePdfDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.pdfService.remove(+id);
  }
}
