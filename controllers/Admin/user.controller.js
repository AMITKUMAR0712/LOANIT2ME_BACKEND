import { prisma } from '../../db/index.js';
import { logActivity, AuditActions, createLogDetails } from '../../utils/auditLogger.js';

export const getUsers = async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      include: {
        lenderTerms: true,
        loansBorrowed: true,
        loansLent: true,
        lenderRelationships: true,
        borrowerRelationships: true,
        auditLogs: true,
      },
    });
    res.json({ users });
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ message: 'Failed to fetch users' });
  }
};

export const updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { fullName, email, phoneNumber, role } = req.body;

    // Get user before update for audit logging
    const userBeforeUpdate = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        fullName: true,
        email: true,
        phoneNumber: true,
        role: true
      }
    });

    const updatedUser = await prisma.user.update({
      where: { id },
      data: { fullName, email, phoneNumber, role },
    });

    // Log user update
    await logActivity(
      req.userId,
      AuditActions.ADMIN_USER_MANAGEMENT,
      createLogDetails("User updated by admin", {
        // targetUserId: id,
        // previousDetails: {
        //   fullName: userBeforeUpdate.fullName,
        //   email: userBeforeUpdate.email,
        //   phoneNumber: userBeforeUpdate.phoneNumber,
        //   role: userBeforeUpdate.role
        // },
        // newDetails: {
        //   fullName,
        //   email,
        //   phoneNumber,
        //   role
        // },
        fullName: fullName !== userBeforeUpdate.fullName ? fullName : undefined,
        email: email !== userBeforeUpdate.email ? email : undefined,
        phoneNumber: phoneNumber !== userBeforeUpdate.phoneNumber ? phoneNumber : undefined,
        role: role !== userBeforeUpdate.role ? role : undefined
      })
    );

    res.json({ message: 'User updated successfully', user: updatedUser });
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({ message: 'Failed to update user' });
  }
};

export const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;

    // Get user before delete for audit logging
    const userToDelete = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        fullName: true,
        email: true,
        role: true
      }
    });

    await prisma.user.delete({ where: { id } });

    // Log user deletion
    await logActivity(
      req.userId,
      AuditActions.ADMIN_USER_MANAGEMENT,
      createLogDetails("User deleted by admin", {
        deletedUser: {
          // id: userToDelete.id,
          fullName: userToDelete.fullName,
          email: userToDelete.email,
          role: userToDelete.role
        }
      })
    );

    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({ message: 'Failed to delete user' });
  }
};

