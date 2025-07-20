import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-pill',
  imports: [],
  templateUrl: './pill.component.html',
  styleUrl: './pill.component.scss',
})
export class PillComponent {
  @Input() public text!: string;
}
