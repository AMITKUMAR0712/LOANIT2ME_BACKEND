import { prisma } from '../../db/index.js';

export const getRelationships = async (req, res) => {
  try {
    const relationships = await prisma.relationship.findMany({
      include: { lender: true, borrower: true },
    });
    res.json({ relationships });
  } catch (error) {
    console.error('Error fetching relationships:', error);
    res.status(500).json({ message: 'Failed to fetch relationships' });
  }
};

export const updateRelationship = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const updatedRelationship = await prisma.relationship.update({
      where: { id },
      data: { status },
      include: { lender: true, borrower: true },
    });
    res.json({ message: 'Relationship updated successfully', relationship: updatedRelationship });
  } catch (error) {
    console.error('Error updating relationship:', error);
    res.status(500).json({ message: 'Failed to update relationship' });
  }
};