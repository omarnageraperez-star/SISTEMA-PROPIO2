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

export const Toast = {
  fire: ({ icon, title }) => {
    if (window.showToast) {
      window.showToast(title, icon);
    } else {
      console.log("Toast:", title, icon);
    }
  }
};

export default DarkSwal;
