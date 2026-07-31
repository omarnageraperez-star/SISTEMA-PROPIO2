import Swal from 'sweetalert2';

// Dark Mobile Theme for SweetAlert2
export const DarkSwal = Swal.mixin({
  background: '#141824',
  color: '#f1f5f9',
  confirmButtonColor: '#f97316',
  cancelButtonColor: '#334155',
  customClass: {
    popup: 'swal-mobile-popup',
  }
});

export const Toast = Swal.mixin({
  toast: true,
  position: 'bottom',
  showConfirmButton: false,
  timer: 2500,
  timerProgressBar: true,
  background: '#141824',
  color: '#f1f5f9'
});

export default DarkSwal;
