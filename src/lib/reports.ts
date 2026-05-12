import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { Vehicle, TimelineEvent } from '../types';
import { formatMileage } from './utils';

export function generateVehicleReport(vehicle: Vehicle, events: TimelineEvent[]) {
  const doc = new jsPDF() as any;

  // Header
  doc.setFontSize(22);
  doc.text('MOTR Vehicle History Report', 20, 20);
  
  doc.setFontSize(12);
  doc.text(`Vehicle: ${vehicle.name}`, 20, 35);
  doc.text(`Make/Model: ${vehicle.make} ${vehicle.model}`, 20, 42);
  doc.text(`Year: ${vehicle.year}`, 20, 49);
  doc.text(`Current Mileage: ${formatMileage(vehicle.currentMileage)}`, 20, 56);
  doc.text(`Report Date: ${new Date().toLocaleDateString()}`, 20, 63);

  // Table
  const tableData = events.map(e => [
    new Date(e.date).toLocaleDateString(),
    e.type,
    formatMileage(e.mileage),
    e.notes || '-'
  ]);

  doc.autoTable({
    startY: 75,
    head: [['Date', 'Service Type', 'Mileage', 'Notes']],
    body: tableData,
    theme: 'grid',
    headStyles: { fillColor: [242, 100, 48] }
  });

  doc.save(`${vehicle.name.replace(/\s+/g, '_')}_history.pdf`);
}
